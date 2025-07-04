// Контроллер для работы с заказами 

const pool = require('../config/db'); // Подключение к БД
const { broadcastNewOrder } = require('./../websocket'); // Метод Websocket
const { generatePDF, generateExcel } = require('./../utils/reportGenerator'); // Утилита для генерации отчета
const { } = require('../services/orders.query.service'); // Запросы

// Получить список всех заказов с пагинацией
exports.getAllOrders = async (req, res) => {
    try {
        // Извлекаем параметры фильтрации
        const {
            page = 1,
            limit = 100,
            sort,
            orderStatus,
            isPaymentStatus,
            paymentMethod,
            date,
            search
        } = req.query;

        const offset = (page - 1) * limit; // Пагинация

        // Валидация параметров пагинации
        if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
            return res.status(400).json({ error: 'Некорректные параметры пагинации' });
        }

        // Базовая часть запроса и условия фильтрации
        let baseQuery = `
            FROM "order" o
            LEFT JOIN "orderStatus" os ON o."orderStatusId" = os.id
            LEFT JOIN "deliveryAddress" da ON o."deliveryAddressId" = da.id
            WHERE 1 = 1
        `;

        const queryParams = [];
        let paramCounter = 1; // Счетчик параметров

        // Фильтрация по дате оформления
        if (date?.start) {
            baseQuery += ` AND o."orderPlacementTime" >= $${paramCounter++}`;
            queryParams.push(new Date(date.start));
        }
        if (date?.end) {
            baseQuery += ` AND o."orderPlacementTime" <= $${paramCounter++}`;
            queryParams.push(new Date(date.end));
        }

        // Фильтрация по статусам
        const orderStatusIds = orderStatus?.map(status => status.id); // Получаем массив id статусов

        if (orderStatusIds?.length > 0) {
            // Если есть статус с id === new, то отделяем его
            const nullIncluded = orderStatusIds.includes('null');
            const idsWithoutNull = orderStatusIds.filter(id => id !== 'null');

            let conditions = []; // Собираем запрос из условий

            if (nullIncluded) {
                // Ищем заказы со статусом NULL
                conditions.push(`o."orderStatusId" IS NULL `);
            }

            if (idsWithoutNull.length > 0) {
                // Ищем по другим статусам
                conditions.push(`o."orderStatusId" = ANY($${paramCounter++}::integer[]) `);
                queryParams.push(idsWithoutNull);
            }

            // Добавляем условие, если есть
            if (conditions.length > 0) {
                baseQuery += ' AND ' + '(' + conditions.join(' OR ') + ')';
            }

        }

        // Фильтр по статусу оплаты
        if (isPaymentStatus) {
            baseQuery += ` AND o."isPaymentStatus" = $${paramCounter++}`;
            queryParams.push(isPaymentStatus === 'Оплачен');
        }

        // Фильтрация по методу оплаты
        const orderPaymentMethods = paymentMethod?.map(status => status.name); // Получаем массив name

        if (orderPaymentMethods?.length > 0) {
            baseQuery += ` AND o."paymentMethod" = ANY($${paramCounter++}::text[]) `;
            queryParams.push(orderPaymentMethods);
        }

        // Фильтация по запросу
        if (search) {
            baseQuery += ` AND o."orderNumber" ILIKE '%' || $${paramCounter++} || '%'`;
            queryParams.push(search);
        }

        // Запрос ДЛЯ ПОДСЧЁТА количества (без LIMIT/OFFSET)
        const countQuery = `
            SELECT COUNT(*) as total
            ${baseQuery}
        `;

        // Фильрация по датам
        if (sort?.type && sort?.order) {
            if (sort.type === 'deliveryDate') baseQuery += ` ORDER BY "endDesiredDeliveryTime" ${sort.order} `;
            if (sort.type === 'orderDate') baseQuery += ` ORDER BY "orderPlacementTime" ${sort.order} `;
        }

        // Запрос ДЛЯ ДАННЫХ (с LIMIT и OFFSET)
        const dataQuery = `
            SELECT 
                o.*,
                os.name as "statusName",
                os."sequenceNumber",
                os."isFinalResultPositive",
                os."isAvailableClient",
                da.city,
                da.street,
                da.house,
                da.apartment
            ${baseQuery}
            LIMIT $${paramCounter++} OFFSET $${paramCounter++}
        `;

        // Добавляем LIMIT и OFFSET в параметры
        queryParams.push(parseInt(limit), parseInt(offset));

        // Выполняем оба запроса параллельно
        const [countResult, ordersResult] = await Promise.all([
            pool.query(countQuery, queryParams.slice(0, -2)), // Исключаем LIMIT и OFFSET
            pool.query(dataQuery, queryParams)
        ]);

        const total = parseInt(countResult.rows[0].total); // Кол-во строк без LIMIT и OFFSET

        res.json({
            total,
            currentPage: parseInt(page),
            limit: parseInt(limit),
            data: ordersResult.rows.map(order => ({
                ...order,
                deliveryAddress: {
                    city: order.city,
                    street: order.street,
                    house: order.house,
                    apartment: order.apartment || null
                },
                status: order.statusName ? {
                    name: order.statusName,
                    sequenceNumber: order.sequenceNumber,
                    isFinalResultPositive: order.isFinalResultPositive,
                    isAvailableClient: order.isAvailableClient
                } : null
            }))
        });

    } catch (error) {
        console.error('Ошибка при получении заказов:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    }
};

// Получить заказ по id
exports.getOrderById = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Транзакция используется для получения данных без изменения в момент выполнения запроса

        // Основные данные заказа
        const orderQuery = `
            SELECT 
                o.*,
                os.name as "statusName",
                os."sequenceNumber",
                os."isFinalResultPositive",
                os."isAvailableClient"
            FROM "order" o
            LEFT JOIN "orderStatus" os ON o."orderStatusId" = os.id
            WHERE o.id = $1
        `;
        const orderResult = await client.query(orderQuery, [req.params.id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        const order = orderResult.rows[0];
        let userEmail = null;

        // Получаем email пользователя, если есть accountId
        if (order.accountId) {
            const emailQuery = `
                SELECT email 
                FROM "account" 
                WHERE id = $1 AND email IS NOT NULL
            `;
            const emailResult = await client.query(emailQuery, [order.accountId]);
            userEmail = emailResult.rows[0]?.email || null;
        }

        // Адрес доставки
        const addressQuery = `
            SELECT *
            FROM "deliveryAddress"
            WHERE id = $1
        `;
        const addressResult = await client.query(addressQuery, [order.deliveryAddressId]);

        // Состав заказа
        const compositionQuery = `
            SELECT 
                co."dishId", 
                co."quantityOrder", 
                co."pricePerUnit",
                d.name as "dishName",
                d."categoryId" as "dishCategory"
            FROM "compositionOrder" co
            LEFT JOIN dish d ON co."dishId" = d.id
            WHERE co."orderId" = $1
        `;
        const compositionResult = await client.query(compositionQuery, [req.params.id]);

        await client.query('COMMIT');

        // Формируем итоговый объект
        const response = {
            ...order,
            deliveryAddress: addressResult.rows[0] || null,
            items: compositionResult.rows,
            status: order.statusName ? {
                name: order.statusName,
                sequenceNumber: order.sequenceNumber,
                isFinal: order.isFinalResultPositive !== null,
                isPositive: order.isFinalResultPositive
            } : null,
            userEmail
        };

        // Очищаем дублирующиеся поля
        delete response.statusName;
        delete response.sequenceNumber;
        delete response.isFinalResultPositive;
        delete response.isAvailableClient;

        res.json(response);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при получении заказа:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    } finally {
        client.release();
    }
}

// Создать заказ для клиента
exports.createOrder = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN');  // Начало транзакции

        // Создание адреса доставки
        const addressQuery = `
            INSERT INTO "deliveryAddress" 
                (city, street, house, apartment, entrance, floor, 
                 comment, "isPrivateHome", latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;
        const addressValues = [
            req.body.address.city,
            req.body.address.street,
            req.body.address.house,
            req.body.address.apartment || null,
            req.body.address.entrance || null,
            req.body.address.floor || null,
            req.body.address.comment || null,
            req.body.address.isPrivateHome,
            req.body.address.coordinates[0],
            req.body.address.coordinates[1]
        ];

        const addressResult = await client.query(addressQuery, addressValues); // Запрос
        const deliveryAddressId = addressResult.rows[0].id; // Получаем Id адреса

        // Получаем список всех статусов заказов
        const statusQuery = `
            SELECT id, name, "sequenceNumber", "isFinalResultPositive", "isAvailableClient"
            FROM "orderStatus"
            ORDER BY "sequenceNumber" DESC
        `;
        const statusResult = await client.query(statusQuery);
        const allStatuses = statusResult.rows;

        // Определяем orderStatusForClient и проверяем финальность статуса
        let orderStatusForClient = 'Создан';
        let orderStatusId = req.body.orderStatusId;
        let orderCompletionTime = null; // По умолчанию NULL

        if (orderStatusId !== null && orderStatusId !== 'null') {
            // Находим текущий статус
            const currentStatus = allStatuses.find(s => s.id == orderStatusId);

            if (currentStatus) {
                // Проверяем, является ли статус финальным
                if (currentStatus.isFinalResultPositive !== null) {
                    orderCompletionTime = 'NOW()'; // Устанавливаем время завершения
                }

                // Логика определения orderStatusForClient
                if (currentStatus.isAvailableClient) {
                    orderStatusForClient = currentStatus.name;
                } else {
                    // Ищем ближайший доступный статус с меньшим sequenceNumber
                    const availableStatus = allStatuses.find(s =>
                        s.sequenceNumber < currentStatus.sequenceNumber &&
                        s.isAvailableClient
                    );

                    orderStatusForClient = availableStatus ? availableStatus.name : 'Создан';
                }
            } else {
                // Если передан несуществующий ID, используем значение по умолчанию
                orderStatusId = null;
            }
        } else {
            orderStatusId = null;
        }

        // Создание заказа с генерацией orderNumber
        const orderQuery = `
            INSERT INTO "order" (
                "orderPlacementTime", ${orderCompletionTime ? '"orderCompletionTime",' : ''} 
                "startDesiredDeliveryTime", "endDesiredDeliveryTime", "deliveryAddressId",
                "orderStatusId", "orderStatusForClient", "shippingCost", "goodsCost", 
                "paymentMethod", "isPaymentStatus", "prepareChangeMoney",
                "commentFromManager", "nameClient", "numberPhoneClient"
            )
            VALUES (
                NOW(), 
                ${orderCompletionTime ? `${orderCompletionTime},` : ''}
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
            RETURNING id, "orderNumber", "orderPlacementTime"
        `;

        const orderValues = [
            req.body.startDesiredDeliveryTime,
            req.body.endDesiredDeliveryTime,
            deliveryAddressId,
            orderStatusId,
            orderStatusForClient,
            req.body.shippingCost,
            req.body.goodsCost,
            req.body.paymentMethod,
            req.body.isPaymentStatus,
            req.body.prepareChangeMoney || null,
            req.body.commentFromManager || null,
            req.body.nameClient || null,
            req.body.numberPhoneClient || null
        ];

        const orderResult = await client.query(orderQuery, orderValues); // Запрос
        const orderId = orderResult.rows[0].id; // Получаем Id заказа

        // Генерация orderNumber и обновление
        const updateOrderNumberQuery = `
            UPDATE "order"
            SET "orderNumber" = 'VR-' || $1
            WHERE id = $1
            RETURNING "orderNumber"
        `;

        await client.query(updateOrderNumberQuery, [orderId]); // Запрос

        // Добавление состава заказа
        const compositionQuery = `
            INSERT INTO "compositionOrder" 
                ("orderId", "dishId", "quantityOrder", "pricePerUnit")
            VALUES ($1, $2, $3, $4)
        `;

        for (const item of req.body.items) {
            await client.query(compositionQuery, [
                orderId,
                item.dishId,
                item.quantityOrder,
                item.pricePerUnit
            ]);
        }

        await client.query('COMMIT'); // Фиксируем успешное завершение транзакции

        res.status(201).json({
            success: true,
            orderId,
            orderNumber: `VR-${orderId}`
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Откат транзакции
        console.error('Transaction error:', error);
        res.status(500).json({
            error: 'Ошибка при создании заказа',
            details: error.message
        });
    } finally {
        client.release(); // Освобождаем клиента
    }
}

// Обновить заказ
exports.updateOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Получаем существующий заказ
        const orderQuery = `SELECT * FROM "order" WHERE id = $1`;
        const orderResult = await client.query(orderQuery, [req.params.id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }
        const existingOrder = orderResult.rows[0];

        // Получаем все статусы заказов
        const statusQuery = `SELECT * FROM "orderStatus" ORDER BY "sequenceNumber" DESC`;
        const statusResult = await client.query(statusQuery);
        const allStatuses = statusResult.rows;

        // Обработка статуса заказа
        let orderStatusForClient = existingOrder.orderStatusForClient;
        let orderStatusId = req.body.orderStatusId;
        let orderCompletionTime = existingOrder.orderCompletionTime;

        // Логика для системного статуса 'null' (Новый)
        if (orderStatusId === 'null' || orderStatusId === null) {
            orderCompletionTime = null;
            orderStatusForClient = 'Создан';
            orderStatusId = null;
        } else {
            const currentStatus = allStatuses.find(s => s.id == orderStatusId);

            if (currentStatus) {
                // Обновляем время завершения если статус финальный
                if (currentStatus.isFinalResultPositive !== null) {
                    orderCompletionTime = 'NOW()';
                } else {
                    orderCompletionTime = null;
                }

                // Определяем статус для клиента
                if (currentStatus.isAvailableClient) {
                    orderStatusForClient = currentStatus.name;
                } else {
                    const availableStatus = allStatuses.find(s =>
                        s.sequenceNumber < currentStatus.sequenceNumber &&
                        s.isAvailableClient
                    );
                    orderStatusForClient = availableStatus ? availableStatus.name : 'Создан';
                }
            }
        }

        // Обновление основных данных заказа
        const updateOrderQuery = `
            UPDATE "order" SET
                "orderStatusId" = $1,
                "orderStatusForClient" = $2,
                "orderCompletionTime" = ${orderCompletionTime ? 'NOW()' : 'NULL'},
                "startDesiredDeliveryTime" = $3,
                "endDesiredDeliveryTime" = $4,
                "shippingCost" = $5,
                "goodsCost" = $6,
                "paymentMethod" = $7,
                "isPaymentStatus" = $8,
                "prepareChangeMoney" = $9,
                "commentFromManager" = $10,
                "nameClient" = $11,
                "numberPhoneClient" = $12
            WHERE id = $13
            RETURNING *
        `;

        const orderValues = [
            orderStatusId,
            orderStatusForClient,
            req.body.startDesiredDeliveryTime,
            req.body.endDesiredDeliveryTime,
            req.body.shippingCost,
            req.body.goodsCost,
            req.body.paymentMethod,
            req.body.isPaymentStatus,
            req.body.prepareChangeMoney || null,
            req.body.commentFromManager || null,
            req.body.nameClient || '',
            req.body.numberPhoneClient || '',
            req.params.id
        ];

        await client.query(updateOrderQuery, orderValues);

        // Обновление адреса доставки
        const updateAddressQuery = `
            UPDATE "deliveryAddress" SET
                city = $1,
                street = $2,
                house = $3,
                apartment = $4,
                entrance = $5,
                floor = $6,
                comment = $7,
                "isPrivateHome" = $8,
                latitude = $9,
                longitude = $10
            WHERE id = $11
        `;

        const addressValues = [
            req.body.address.city,
            req.body.address.street,
            req.body.address.house,
            req.body.address.apartment || null,
            req.body.address.entrance || null,
            req.body.address.floor || null,
            req.body.address.comment || null,
            req.body.address.isPrivateHome,
            req.body.address.coordinates[0],
            req.body.address.coordinates[1],
            existingOrder.deliveryAddressId
        ];

        await client.query(updateAddressQuery, addressValues);

        // Обновление состава заказа
        await client.query('DELETE FROM "compositionOrder" WHERE "orderId" = $1', [req.params.id]);

        const compositionQuery = `
            INSERT INTO "compositionOrder" 
                ("orderId", "dishId", "quantityOrder", "pricePerUnit")
            VALUES ($1, $2, $3, $4)
        `;

        for (const item of req.body.items) {
            await client.query(compositionQuery, [
                req.params.id,
                item.dishId,
                item.quantityOrder,
                item.pricePerUnit
            ]);
        }

        await client.query('COMMIT');

        res.json({ success: true });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при обновлении заказа:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    } finally {
        client.release();
    }
}

// Изменить статус заказов (массово)
exports.changeOrderStatuses = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { orderIds, newStatusId } = req.body;

        // Валидация входных данных
        if (!Array.isArray(orderIds) || orderIds.length === 0 || !newStatusId) {
            return res.status(400).json({ error: 'Некорректные параметры запроса' });
        }

        let orderStatusForClient = 'Создан';
        let orderCompletionTime = null;
        let statusIdToSet = null;

        // Обработка системного статуса 'null'
        if (newStatusId === 'null' || newStatusId === null) {
            statusIdToSet = null;
        } else {
            // Получаем все статусы заказов только если это не системный статус
            const statusQuery = `SELECT * FROM "orderStatus" ORDER BY "sequenceNumber" DESC`;
            const statusResult = await client.query(statusQuery);
            const allStatuses = statusResult.rows;

            const newStatus = allStatuses.find(s => s.id == newStatusId);
            if (!newStatus) {
                return res.status(400).json({ error: 'Указан несуществующий статус' });
            }

            // Определяем параметры для обновления
            const isFinal = newStatus.isFinalResultPositive !== null;
            orderCompletionTime = isFinal ? 'NOW()' : null;

            // Определяем статус для клиента
            orderStatusForClient = newStatus.isAvailableClient
                ? newStatus.name
                : allStatuses.find(s =>
                    s.sequenceNumber < newStatus.sequenceNumber &&
                    s.isAvailableClient
                )?.name || 'Создан';

            statusIdToSet = newStatusId;
        }

        // Массовое обновление заказов
        const updateQuery = `
            UPDATE "order" SET
                "orderStatusId" = $1,
                "orderStatusForClient" = $2,
                "orderCompletionTime" = ${orderCompletionTime ? 'NOW()' : 'NULL'}
            WHERE id = ANY($3::integer[])
            RETURNING id
        `;

        const updateResult = await client.query(updateQuery, [
            statusIdToSet,
            orderStatusForClient,
            orderIds
        ]);

        // Проверяем количество обновленных записей
        if (updateResult.rowCount !== orderIds.length) {
            const updatedIds = updateResult.rows.map(r => r.id);
            const missingIds = orderIds.filter(id => !updatedIds.includes(parseInt(id)));
            console.warn('Не найдены заказы:', missingIds);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            updated: updateResult.rowCount,
            warnings: updateResult.rowCount !== orderIds.length
                ? `Некоторые заказы не найдены`
                : null
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при массовом обновлении статусов:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    } finally {
        client.release();
    }
}

// Изменить статус оплаты заказов (массово)
exports.changeOrderPaymentStatuses = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { orderIds, isPaymentStatus } = req.body;

        // Валидация входных данных
        if (!Array.isArray(orderIds) || orderIds.length === 0 || typeof isPaymentStatus !== 'boolean') {
            return res.status(400).json({ error: 'Некорректные параметры запроса' });
        }

        // Массовое обновление заказов
        const updateQuery = `
            UPDATE "order" SET
                "isPaymentStatus" = $1
            WHERE id = ANY($2::integer[])
            RETURNING id
        `;

        const updateResult = await client.query(updateQuery, [
            isPaymentStatus,
            orderIds
        ]);

        // Проверяем количество обновленных записей
        if (updateResult.rowCount !== orderIds.length) {
            const updatedIds = updateResult.rows.map(r => r.id);
            const missingIds = orderIds.filter(id => !updatedIds.includes(parseInt(id)));
            console.warn('Не найдены заказы:', missingIds);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            updated: updateResult.rowCount,
            warnings: updateResult.rowCount !== orderIds.length
                ? `Некоторые заказы не найдены`
                : null
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при массовом обновлении статусов оплаты:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    } finally {
        client.release();
    }
}

// Удалить заказ(ы)
exports.deleteOrders = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { orderIds } = req.body;

        // Валидация входных данных
        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ error: 'Некорректные параметры запроса' });
        }

        // Удаляем заказы и получаем их deliveryAddressId
        const deleteOrderQuery = `
            DELETE FROM "order"
            WHERE id = ANY($1::integer[])
            RETURNING id, "deliveryAddressId"
        `;
        const deleteOrderResult = await client.query(deleteOrderQuery, [orderIds]);

        // Собираем уникальные идентификаторы адресов
        const addressIds = deleteOrderResult.rows.map(row => row.deliveryAddressId);
        const uniqueAddressIds = [...new Set(addressIds)];

        // Удаляем связанные адреса, если они есть
        if (uniqueAddressIds.length > 0) {
            await client.query(`
                DELETE FROM "deliveryAddress"
                WHERE id = ANY($1::integer[])
            `, [uniqueAddressIds]);
        }

        // Проверяем, все ли заказы удалены
        if (deleteOrderResult.rowCount !== orderIds.length) {
            const deletedIds = deleteOrderResult.rows.map(r => r.id);
            const missingIds = orderIds.filter(id => !deletedIds.includes(parseInt(id)));
            console.warn('Не найдены заказы:', missingIds);
        }

        await client.query('COMMIT');

        await client.query('COMMIT');
        res.json({
            success: true,
            deletedOrders: deleteOrderResult.rowCount,
            deletedAddresses: uniqueAddressIds.length,
            warnings: deleteOrderResult.rowCount !== orderIds.length
                ? 'Некоторые заказы не найдены'
                : null
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Ошибка при массовом удалении заказов:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    } finally {
        client.release();
    }
};

// Получить список заказов клиента
exports.getOrdersByIdClient = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        // Получаем основные данные заказов
        const ordersQuery = `
            SELECT id, "orderNumber", "orderPlacementTime", 
                   "startDesiredDeliveryTime", "endDesiredDeliveryTime", 
                   "accountId", "deliveryAddressId", "orderStatusForClient", 
                   "shippingCost", "goodsCost", "paymentMethod", 
                   "isPaymentStatus", "prepareChangeMoney", 
                   "commentFromClient", "nameClient", "numberPhoneClient"
            FROM "order"
            WHERE "accountId" = $1
            ORDER BY "orderPlacementTime" DESC
        `;
        const ordersResult = await client.query(ordersQuery, [req.params.id]);
        const orders = ordersResult.rows;

        if (orders.length === 0) { // Если список заказов пуст, то возвращаем пустой массив
            await client.query('COMMIT'); // Фиксируем успешное завершение транзакции
            return res.json([]);
        }

        // Получаем адреса доставки и состав заказов для каждого заказа
        const enhancedOrders = [];

        for (const order of orders) {
            // Получаем адрес доставки
            const addressQuery = `
                SELECT id, "accountId", city, street, house, 
                       apartment, entrance, floor, comment, 
                       "isPrivateHome", latitude, longitude
                FROM "deliveryAddress"
                WHERE id = $1
            `;
            const addressResult = await client.query(addressQuery, [order.deliveryAddressId]);

            // Получаем состав заказа с названиями блюд
            const compositionQuery = `
                SELECT co."dishId", co."quantityOrder", 
                       co."pricePerUnit", d.name as "dishName"
                FROM "compositionOrder" co
                JOIN dish d ON co."dishId" = d.id
                WHERE co."orderId" = $1
            `;
            const compositionResult = await client.query(compositionQuery, [order.id]);

            // Собираем расширенный объект заказа
            enhancedOrders.push({
                ...order,
                deliveryAddress: addressResult.rows[0],
                items: compositionResult.rows
            });
        }

        await client.query('COMMIT'); // Фиксируем успешное завершение транзакции
        res.json(enhancedOrders);

    } catch (error) {
        await client.query('ROLLBACK');  // Откат транзакции
        console.error('Transaction error:', error);
        res.status(500).json({
            error: 'Ошибка при получении заказов',
            details: error.message
        });
    } finally {
        client.release(); // Освобождаем клиента
    }
};

// Оформление заказа клиентом 
exports.createOrderClient = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN');  // Начало транзакции

        // Создание адреса доставки
        const addressQuery = `
            INSERT INTO "deliveryAddress" 
                (city, street, house, apartment, entrance, floor, 
                 comment, "isPrivateHome", latitude, longitude)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;
        const addressValues = [
            req.body.address.city,
            req.body.address.street,
            req.body.address.house,
            req.body.address.apartment || null,
            req.body.address.entrance || null,
            req.body.address.floor || null,
            req.body.address.comment || null,
            req.body.address.isPrivateHome,
            req.body.address.coordinates[0],
            req.body.address.coordinates[1]
        ];

        const addressResult = await client.query(addressQuery, addressValues); // Запрос
        const deliveryAddressId = addressResult.rows[0].id; // Получаем Id адреса

        // Создание заказа с генерацией orderNumber
        const orderQuery = `
            INSERT INTO "order" (
                "orderPlacementTime", "startDesiredDeliveryTime", 
                "endDesiredDeliveryTime", "accountId", "deliveryAddressId",
                "orderStatusForClient", "shippingCost", "goodsCost", 
                "paymentMethod", "isPaymentStatus", "prepareChangeMoney",
                "commentFromClient", "nameClient", "numberPhoneClient"
            )
            VALUES (
                NOW(), $1, $2, $3, $4, 
                'Создан', $5, $6, $7, $8, $9, $10, $11, $12
            )
            RETURNING id, "orderNumber", "orderPlacementTime"
        `;

        const orderValues = [
            req.body.startDesiredDeliveryTime,
            req.body.endDesiredDeliveryTime,
            req.body.accountId || null,
            deliveryAddressId,
            req.body.shippingCost,
            req.body.goodsCost,
            req.body.paymentMethod,
            req.body.isPaymentStatus,
            req.body.prepareChangeMoney || null,
            req.body.commentFromClient || null,
            req.body.nameClient || null,
            req.body.numberPhoneClient || null
        ];

        const orderResult = await client.query(orderQuery, orderValues); // Запрос
        const orderId = orderResult.rows[0].id; // Получаем Id заказа

        // Генерация orderNumber и обновление
        const updateOrderNumberQuery = `
            UPDATE "order"
            SET "orderNumber" = 'VR-' || $1
            WHERE id = $1
            RETURNING "orderNumber"
        `;

        await client.query(updateOrderNumberQuery, [orderId]); // Запрос

        // Добавление состава заказа
        const compositionQuery = `
            INSERT INTO "compositionOrder" 
                ("orderId", "dishId", "quantityOrder", "pricePerUnit")
            VALUES ($1, $2, $3, $4)
        `;

        for (const item of req.body.items) {
            await client.query(compositionQuery, [
                orderId,
                item.dishId,
                item.quantityOrder,
                item.pricePerUnit
            ]);
        }

        // Очистка корзины для авторизованных пользователей
        if (req.body.accountId) { // Если передан токен с id
            await client.query(
                'DELETE FROM "shoppingCart" WHERE "accountId" = $1',
                [req.body.accountId]
            );
        }

        await client.query('COMMIT'); // Фиксируем успешное завершение транзакции

        try {
            // После успешного создания заказа передаём менеджеру уведомление
            broadcastNewOrder(orderId, `VR-${orderId}`, orderResult.rows[0].orderPlacementTime);
        } catch (error) { }

        res.status(201).json({
            success: true,
            orderId,
            orderNumber: `VR-${orderId}`
        });

    } catch (error) {
        await client.query('ROLLBACK'); // Откат транзакции
        console.error('Transaction error:', error);
        res.status(500).json({
            error: 'Ошибка при создании заказа',
            details: error.message
        });
    } finally {
        client.release(); // Освобождаем клиента
    }
};

// Получить отчёт по продажам блюд с пагинацией, группировкой и фильтрами
exports.getDishSalesReport = async (req, res) => {
    try {
        // Извлекаем параметры запроса
        const {
            page = 1,
            limit = 100,
            sort,
            date,
            categories,
            isPaymentStatus,
            isCompletionStatus
        } = req.query;

        const offset = (page - 1) * limit;

        // Валидация параметров пагинации
        if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
            return res.status(400).json({ error: 'Некорректные параметры пагинации' });
        }

        // Базовый запрос для агрегации данных
        let baseQuery = `
            SELECT 
                d.id AS "dishId",
                d.name AS "dishName",
                c.id AS "categoryId",
                c.name AS "categoryName",
                SUM(co."quantityOrder") AS "totalQuantity",
                ROUND(AVG(co."pricePerUnit")::numeric, 2) AS "averagePrice",
                SUM(co."quantityOrder" * co."pricePerUnit") AS "totalAmount"
            FROM "compositionOrder" co
            INNER JOIN "order" o ON co."orderId" = o.id
            INNER JOIN dish d ON co."dishId" = d.id
            INNER JOIN category c ON d."categoryId" = c.id
            WHERE 1 = 1
        `;

        const queryParams = [];
        let paramCounter = 1;

        // Фильтрация по дате оформления заказа
        if (date?.start) {
            baseQuery += ` AND o."orderPlacementTime" >= $${paramCounter++}`;
            queryParams.push(new Date(date.start));
        }
        if (date?.end) {
            baseQuery += ` AND o."orderPlacementTime" <= $${paramCounter++}`;
            queryParams.push(new Date(date.end));
        }

        // Фильтрация по категориям
        const categoryIds = categories?.map(category => category.id); // Получаем массив id категорий

        if (categoryIds?.length > 0) {
            baseQuery += ` AND c.id = ANY($${paramCounter++}::integer[])`;
            queryParams.push(categoryIds);
        }

        // Фильтрация по статусу оплаты
        if (isPaymentStatus) {
            baseQuery += ` AND o."isPaymentStatus" = $${paramCounter++}`;
            queryParams.push(isPaymentStatus === 'Оплачен');
        }

        // Фильтрация по статусу завершения заказа
        if (isCompletionStatus) {
            if (isCompletionStatus === 'Завершен') {
                baseQuery += ` AND o."orderCompletionTime" IS NOT NULL`;
            } else {
                baseQuery += ` AND o."orderCompletionTime" IS NULL`;
            }
        }

        // Группировка
        baseQuery += ` GROUP BY d.id, c.id `;

        // Сортировка
        if (sort?.type && sort?.order) {
            const sortColumn = {
                'quantity': '"totalQuantity"',
                'amount': '"totalAmount"'
            }[sort.type];

            if (sortColumn) {
                baseQuery += ` ORDER BY ${sortColumn} ${sort.order} `;
            }
        } else {
            baseQuery += ` ORDER BY "totalQuantity" DESC `;
        }

        // Запрос для данных с пагинацией
        const dataQuery = `
            ${baseQuery}
            LIMIT $${paramCounter++} OFFSET $${paramCounter++}
        `;

        // Запрос для общих сумм
        const totalsQuery = `
            SELECT 
                SUM(sub."totalQuantity") AS "totalSold",
                SUM(sub."totalAmount") AS "totalRevenue"
            FROM (${baseQuery}) sub
        `;

        // Параметры для пагинации
        const paginationParams = [parseInt(limit), parseInt(offset)];
        const fullParams = [...queryParams, ...paginationParams];

        // Выполнение запросов
        const [dataResult, totalsResult] = await Promise.all([
            pool.query(dataQuery, fullParams),
            pool.query(totalsQuery, queryParams)
        ]);

        // Формирование ответа
        res.json({
            total: dataResult.rowCount,
            currentPage: parseInt(page),
            limit: parseInt(limit),
            totalSold: parseInt(totalsResult.rows[0]?.totalSold || 0),
            totalRevenue: parseFloat(totalsResult.rows[0]?.totalRevenue || 0),
            data: dataResult.rows.map(row => ({
                dishId: row.dishId,
                dishName: row.dishName,
                categoryId: row.categoryId,
                categoryName: row.categoryName,
                totalQuantity: parseInt(row.totalQuantity),
                averagePrice: parseFloat(row.averagePrice),
                totalAmount: parseFloat(row.totalAmount)
            }))
        });

    } catch (error) {
        console.error('Ошибка при получении отчёта:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    }
};

// Получить отчёт по заказам с пагинацией и статистикой
exports.getOrdersReport = async (req, res) => {
    try {
        // Извлекаем параметры фильтрации и пагинации
        const {
            page = 1,
            limit = 100,
            sort,
            orderStatus,
            isPaymentStatus,
            paymentMethod,
            date
        } = req.query;

        const offset = (page - 1) * limit; // Пагинация

        // Валидация пагинации
        if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
            return res.status(400).json({ error: 'Некорректные параметры пагинации' });
        }

        // Базовая часть запроса и условия фильтрации
        let baseQuery = `
            FROM "order" o
            LEFT JOIN "orderStatus" os ON o."orderStatusId" = os.id
            LEFT JOIN "deliveryAddress" da ON o."deliveryAddressId" = da.id
            WHERE 1 = 1
        `;

        const queryParams = [];
        let paramCounter = 1; // Счетчик параметров

        // Фильтрация по дате оформления
        if (date?.start) {
            baseQuery += ` AND o."orderPlacementTime" >= $${paramCounter++}`;
            queryParams.push(new Date(date.start));
        }
        if (date?.end) {
            baseQuery += ` AND o."orderPlacementTime" <= $${paramCounter++}`;
            queryParams.push(new Date(date.end));
        }

        // Фильтрация по статусам
        const orderStatusIds = orderStatus?.map(status => status.id);  // Получаем массив id статусов
        if (orderStatusIds?.length > 0) {
            const nullIncluded = orderStatusIds.includes('null'); // Если есть статус с id === new, то отделяем его
            const idsWithoutNull = orderStatusIds.filter(id => id !== 'null');
            let conditions = []; // Собираем запрос из условий

            if (nullIncluded) conditions.push(`o."orderStatusId" IS NULL`); // Ищем заказы со статусом NULL
            if (idsWithoutNull.length > 0) { // Ищем по другим статусам
                conditions.push(`o."orderStatusId" = ANY($${paramCounter++}::integer[])`);
                queryParams.push(idsWithoutNull);
            }

            if (conditions.length > 0) { // Добавляем условие, если есть
                baseQuery += ' AND (' + conditions.join(' OR ') + ')';
            }
        }

        // Фильтр по статусу оплаты
        if (isPaymentStatus) {
            baseQuery += ` AND o."isPaymentStatus" = $${paramCounter++}`;
            queryParams.push(isPaymentStatus === 'Оплачен');
        }

        // Фильтр метода оплаты
        const orderPaymentMethods = paymentMethod?.map(status => status.name); // Получаем массив name
        if (orderPaymentMethods?.length > 0) {
            baseQuery += ` AND o."paymentMethod" = ANY($${paramCounter++}::text[]) `;
            queryParams.push(orderPaymentMethods);
        }

        // Запрос для данных
        const dataQuery = `
            SELECT 
                o.*,
                os.name as "statusName",
                os."sequenceNumber",
                os."isFinalResultPositive",
                os."isAvailableClient",
                da.city,
                da.street,
                da.house,
                da.apartment
            ${baseQuery}
            ${sort?.type && sort?.order ?
                `ORDER BY ${sort.type === 'deliveryDate' ?
                    '"endDesiredDeliveryTime"' :
                    '"orderPlacementTime"'} ${sort.order}` : ''}
            LIMIT $${paramCounter++} OFFSET $${paramCounter++}
        `;

        // Запрос для статистики
        const statsQuery = `
            SELECT
                COUNT(*) as "totalOrders",
                SUM("goodsCost" + "shippingCost") as "totalRevenue",
                SUM("goodsCost") as "totalGoodsCost",
                SUM("shippingCost") as "totalShippingCost",
                AVG("goodsCost" + "shippingCost") as "averageOrderValue"
            ${baseQuery}
        `;

        // Параметры пагинации
        const paginationParams = [parseInt(limit), parseInt(offset)];
        const fullParams = [...queryParams, ...paginationParams];

        // Выполнение запросов
        const [dataResult, statsResult] = await Promise.all([
            pool.query(dataQuery, fullParams),
            pool.query(statsQuery, queryParams)
        ]);

        const stats = statsResult.rows[0];
        const totalOrders = parseInt(stats.totalOrders) || 0;

        // Форматирование статистики
        const response = {
            data: dataResult.rows.map(order => ({
                ...order,
                deliveryAddress: {
                    city: order.city,
                    street: order.street,
                    house: order.house,
                    apartment: order.apartment || null
                },
                status: order.statusName ? {
                    name: order.statusName,
                    sequenceNumber: order.sequenceNumber,
                    isFinalResultPositive: order.isFinalResultPositive,
                    isAvailableClient: order.isAvailableClient
                } : null
            })),
            pagination: {
                total: totalOrders,
                currentPage: parseInt(page),
                limit: parseInt(limit)
            },
            statistics: {
                totalRevenue: parseFloat(stats.totalRevenue || 0),
                totalGoodsCost: parseFloat(stats.totalGoodsCost || 0),
                totalShippingCost: parseFloat(stats.totalShippingCost || 0),
                averageOrderValue: totalOrders > 0
                    ? parseFloat(stats.averageOrderValue)
                    : 0
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Ошибка при формировании отчёта:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    }
};

// Маппинг колонок из таблицы для отчётности по заказам
const COLUMN_MAPPING_ORDERS_REPORT = {
    'Номер': 'o."orderNumber" as "Номер"',
    'Дата и время оформления': 'to_char(o."orderPlacementTime" AT TIME ZONE \'Europe/Moscow\', \'DD.MM.YYYY HH24:MI\') as "Дата и время оформления"',
    'Дата и время доставки': `
        CASE 
            WHEN o."startDesiredDeliveryTime" IS NOT NULL AND o."endDesiredDeliveryTime" IS NOT NULL 
            THEN 
                CASE 
                    WHEN to_char(o."startDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'DD.MM.YYYY\') = to_char(o."endDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'DD.MM.YYYY\') 
                    THEN to_char(o."startDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'DD.MM.YYYY\') || \' \' || 
                         to_char(o."startDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'HH24:MI\') || \' - \' || 
                         to_char(o."endDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'HH24:MI\')
                    ELSE to_char(o."startDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'DD.MM.YYYY HH24:MI\') || \' - \' || 
                         to_char(o."endDesiredDeliveryTime" AT TIME ZONE \'Europe/Moscow\', \'DD.MM.YYYY HH24:MI\')
                END
            ELSE '—'
        END as "Дата и время доставки"
    `,
    'Товары': 'o."goodsCost" as "Товары"',
    'Доставка': 'o."shippingCost" as "Доставка"',
    'Сумма': '(o."goodsCost" + o."shippingCost") as "Сумма"',
    'Статус заказа': 'COALESCE(os.name, \'Новый\') as "Статус заказа"',
    'Статус оплаты': `CASE WHEN o."isPaymentStatus" THEN 'Оплачен' ELSE 'Не оплачен' END as "Статус оплаты"`,
    'Способ оплаты': 'o."paymentMethod" as "Способ оплаты"',
    'Адрес доставки': `CONCAT(da.city, ', ', da.street, ', д. ', da.house, 
    CASE WHEN da.apartment IS NOT NULL THEN ', кв. ' || da.apartment ELSE '' END) as "Адрес доставки"`,
    'Комментарий клиента': 'o."commentFromClient" as "Комментарий клиента"',
    'Комментарий менеджера': 'o."commentFromManager" as "Комментарий менеджера"',
    'Имя клиента': 'o."nameClient" as "Имя клиента"',
    'Телефон клиента': 'o."numberPhoneClient" as "Телефон клиента"'
};

// Генерация отчёта по заказам (без пагинации)
exports.generateOrdersReport = async (req, res) => {
    try {
        const {
            sort,
            orderStatus,
            isPaymentStatus,
            paymentMethod,
            date,
            columns // Массив выбранных колонок
        } = req.query;

        // Проверка наличия столбцов
        if (!Array.isArray(columns)) {
            return res.status(400).json({ error: 'Некорректный формат столбцов' });
        }
        if (columns.length === 0) {
            return res.status(400).json({ error: 'Выберите минимум один столбец для отчёта' });
        }

        // Получаем тип отчета
        const reportType = 'по заказам';

        // Базовая часть запроса и условия фильтрации
        let baseQuery = `
            FROM "order" o
            LEFT JOIN "orderStatus" os ON o."orderStatusId" = os.id
            LEFT JOIN "deliveryAddress" da ON o."deliveryAddressId" = da.id
            WHERE 1 = 1
        `;

        const queryParams = [];
        let paramCounter = 1; // Счетчик параметров

        // Сбор данных о применённых фильтрах
        const appliedFilters = {};

        // Фильтрация по дате оформления
        if (date?.start) {
            baseQuery += ` AND o."orderPlacementTime" >= $${paramCounter++}`;
            queryParams.push(new Date(date.start));
        }
        if (date?.end) {
            baseQuery += ` AND o."orderPlacementTime" <= $${paramCounter++}`;
            queryParams.push(new Date(date.end));
        }

        // Форматирование времени
        function formatDate(date) {
            if (!date) return '—';
            const d = new Date(date);
            return `${String(d.getDate()).padStart(2, '0')}.` +
                `${String(d.getMonth() + 1).padStart(2, '0')}.` +
                `${d.getFullYear()} ` +
                `${String(d.getHours()).padStart(2, '0')}:` +
                `${String(d.getMinutes()).padStart(2, '0')}`;
        }

        // Период
        if (date?.start || date?.end) {
            const start = formatDate(date.start);
            const end = formatDate(date.end);
            appliedFilters['Период оформления'] = `с ${start} по ${end}`;
        }

        // Фильтрация по статусам
        const orderStatusIds = orderStatus?.map(status => status.id);  // Получаем массив id статусов
        if (orderStatusIds?.length > 0) {
            const nullIncluded = orderStatusIds.includes('null'); // Если есть статус с id === new, то отделяем его
            const idsWithoutNull = orderStatusIds.filter(id => id !== 'null');
            let conditions = []; // Собираем запрос из условий

            if (nullIncluded) conditions.push(`o."orderStatusId" IS NULL`); // Ищем заказы со статусом NULL
            if (idsWithoutNull.length > 0) { // Ищем по другим статусам
                conditions.push(`o."orderStatusId" = ANY($${paramCounter++}::integer[])`);
                queryParams.push(idsWithoutNull);
            }

            if (conditions.length > 0) { // Добавляем условие, если есть
                baseQuery += ' AND (' + conditions.join(' OR ') + ')';
            }

            // Примененные фильтры для отчета
            if (orderStatusIds?.length > 0) {
                // Получаем названия статусов из БД
                const statusQuery = `SELECT id, name FROM "orderStatus" WHERE id = ANY($1)`;
                const statusResult = await pool.query(statusQuery, [idsWithoutNull]);
                const statusNames = statusResult.rows.map(s => s.name);

                if (nullIncluded) statusNames.unshift('Новый');
                appliedFilters[`${orderStatusIds?.length === 1 ? 'Статус заказа' : 'Статусы заказа'}`] = statusNames.join(', ');
            }

        }

        // Фильтр по статусу оплаты
        if (isPaymentStatus) {
            baseQuery += ` AND o."isPaymentStatus" = $${paramCounter++}`;
            queryParams.push(isPaymentStatus === 'Оплачен');
        }

        // Статус оплаты (Примененные фильтры для отчета)
        if (isPaymentStatus) {
            const statusName = isPaymentStatus ? 'Оплачен' : 'Не оплачен';
            appliedFilters['Статус оплаты'] = statusName;
        }

        // Фильтр метода оплаты
        const orderPaymentMethods = paymentMethod?.map(status => status.name); // Получаем массив name
        if (orderPaymentMethods?.length > 0) {
            baseQuery += ` AND o."paymentMethod" = ANY($${paramCounter++}::text[]) `;
            queryParams.push(orderPaymentMethods);
        }

        // Способ оплаты
        if (orderPaymentMethods?.length > 0) {
            const paymentNames = orderPaymentMethods.map(m => {
                return {
                    'online': 'Онлайн',
                    'cash': 'Наличные',
                    'card': 'Картой при получении'
                }[m] || m;
            });
            appliedFilters[`${orderPaymentMethods?.length === 1 ? 'Способ оплаты' : 'Способы оплаты'}`] = paymentNames.join(', ');
        }

        // Сортировка
        if (sort?.type && sort?.order) {
            const sortLabels = {
                'orderDate': 'По дате заказа',
                'deliveryDate': 'По дате доставки'
            };
            const orderLabels = {
                'asc': sort.type === 'orderDate' ? 'сначал старые' : 'сначал ближе',
                'desc': sort.type === 'orderDate' ? 'сначала новые' : 'сначала дальше'
            };
            appliedFilters['Сортировка'] = `${sortLabels[sort.type]} (${orderLabels[sort.order]})`;
        }

        // Преобразование русских колонок в SQL-выражения
        const sqlColumns = columns.map(col => {
            const expression = COLUMN_MAPPING_ORDERS_REPORT[col];
            if (!expression) throw new Error(`Неизвестная колонка: ${col}`);
            return expression;
        });

        // Запрос для данных
        const dataQuery = `
            SELECT 
                  ${sqlColumns.join(', ')}
            ${baseQuery}
            ${sort?.type && sort?.order ?
                `ORDER BY ${sort.type === 'deliveryDate' ?
                    '"endDesiredDeliveryTime"' :
                    '"orderPlacementTime"'} ${sort.order}` : ''}
        `;

        // Запрос для статистики
        const statsQuery = `
            SELECT
                COUNT(*) as "totalOrders",
                SUM("goodsCost" + "shippingCost") as "totalRevenue",
                SUM("goodsCost") as "totalGoodsCost",
                SUM("shippingCost") as "totalShippingCost",
                AVG("goodsCost" + "shippingCost") as "averageOrderValue"
            ${baseQuery}
        `;

        const [dataResult, statsResult] = await Promise.all([
            pool.query(dataQuery, queryParams),
            pool.query(statsQuery, queryParams)
        ]);

        const stats = statsResult.rows[0];

        // Генерация файла
        const reportData = {
            reportType: reportType,
            filters: appliedFilters, // Применённые фильтры
            columns: columns, // Русские заголовки
            data: dataResult.rows.map(row => ({
                ...row,
                Товары: parseFloat(row.Товары?.toFixed(2)),
                Доставка: parseFloat(row.Доставка?.toFixed(2)),
                Сумма: parseFloat(row.Сумма?.toFixed(2))
            })),
            stats: {
                "Всего заказов": parseInt(stats.totalOrders || '0'),
                "Общая выручка": parseFloat(stats.totalRevenue?.toFixed(2) || '0'),
                "Стоимость товаров": parseFloat(stats.totalGoodsCost?.toFixed(2) || '0'),
                "Стоимость доставки": parseFloat(stats.totalShippingCost?.toFixed(2) || '0'),
                "Средний чек": parseFloat(stats.averageOrderValue?.toFixed(2) || '0')
            }
        };

        if (req.query.format === 'pdf') {
            const pdfBuffer = await generatePDF(reportData);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment;`
            });
            res.send(Buffer.from(pdfBuffer));
        } else {
            const excelBuffer = await generateExcel(reportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(excelBuffer);
        }

    } catch (error) {
        console.error('Ошибка генерации отчёта:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
}

// Маппинг колонок из таблицы для отчётности по товарам
const COLUMN_MAPPING_DISH_SALES_REPORT = {
    'Наименование': 'd.name as "Наименование"',
    'Категория': 'c.name as "Категория"',
    'Количество': 'SUM(co."quantityOrder") as "Количество"',
    'Цена': 'AVG(co."pricePerUnit") as "Цена"',
    'Сумма': 'SUM(co."quantityOrder" * co."pricePerUnit") as "Сумма"'
};

// Генерация отчёта по товарам (без пагинации)
exports.generateDishSalesReport = async (req, res) => {
    try {
        const {
            sort,
            date,
            categories,
            isPaymentStatus,
            isCompletionStatus,
            columns // Массив выбранных колонок
        } = req.query;

        // Проверка наличия столбцов
        if (!Array.isArray(columns)) {
            return res.status(400).json({ error: 'Некорректный формат столбцов' });
        }
        if (columns.length === 0) {
            return res.status(400).json({ error: 'Выберите минимум один столбец для отчёта' });
        }

        // Получаем тип отчета
        const reportType = 'по товарам';

        // Базовая часть запроса и условия фильтрации
        let baseQuery = `
        FROM "compositionOrder" co
        INNER JOIN "order" o ON co."orderId" = o.id
        INNER JOIN dish d ON co."dishId" = d.id
        INNER JOIN category c ON d."categoryId" = c.id
        WHERE 1 = 1
    `;

        const queryParams = [];
        let paramCounter = 1; // Счетчик параметров

        // Сбор данных о применённых фильтрах
        const appliedFilters = {};

        // Фильтрация по дате оформления заказа
        if (date?.start) {
            baseQuery += ` AND o."orderPlacementTime" >= $${paramCounter++}`;
            queryParams.push(new Date(date.start));
        }
        if (date?.end) {
            baseQuery += ` AND o."orderPlacementTime" <= $${paramCounter++}`;
            queryParams.push(new Date(date.end));
        }

        // Форматирование времени
        function formatDate(date) {
            if (!date) return '—';
            const d = new Date(date);
            return `${String(d.getDate()).padStart(2, '0')}.` +
                `${String(d.getMonth() + 1).padStart(2, '0')}.` +
                `${d.getFullYear()} ` +
                `${String(d.getHours()).padStart(2, '0')}:` +
                `${String(d.getMinutes()).padStart(2, '0')}`;
        }

        // Период
        if (date?.start || date?.end) {
            const start = formatDate(date.start);
            const end = formatDate(date.end);
            appliedFilters['Период оформления'] = `с ${start} по ${end}`;
        }

        // Фильтрация по категориям
        const categoryIds = categories?.map(category => category.id); // Получаем массив id категорий

        if (categoryIds?.length > 0) {
            baseQuery += ` AND c.id = ANY($${paramCounter++}::integer[])`;
            queryParams.push(categoryIds);

            // Получаем названия категорий из БД
            const categoryQuery = `SELECT name FROM category WHERE id = ANY($1)`;
            const categoryResult = await pool.query(categoryQuery, [categoryIds]);
            appliedFilters[`${categoryIds?.length === 1 ? 'Категория' : 'Категории'}`] = categoryResult.rows.map(r => r.name).join(', ');
        }

        // Фильтрация по статусу оплаты
        if (isPaymentStatus) {
            baseQuery += ` AND o."isPaymentStatus" = $${paramCounter++}`;
            queryParams.push(isPaymentStatus === 'Оплачен');
            appliedFilters['Статус оплаты'] = isPaymentStatus ? 'Оплачен' : 'Не оплачен';
        }

        // Фильтрация по статусу завершения
        if (isCompletionStatus) {
            if (isCompletionStatus === 'Завершен') {
                baseQuery += ` AND o."orderCompletionTime" IS NOT NULL`;
            } else {
                baseQuery += ` AND o."orderCompletionTime" IS NULL`;
            }
            appliedFilters['Статус выполнения'] = isCompletionStatus;
        }

        // Группировка
        baseQuery += ` GROUP BY d.id, c.id `;

        // Сортировка
        if (sort?.type && sort?.order) {
            const sortColumn = {
                'quantity': 'SUM(co."quantityOrder")',
                'amount': 'SUM(co."quantityOrder" * co."pricePerUnit")'
            }[sort.type];

            if (sortColumn) {
                baseQuery += ` ORDER BY ${sortColumn} ${sort.order}`;
                appliedFilters['Сортировка'] = `${sort.type === 'quantity' ? 'По количеству' : 'По сумме'} (${sort.order === 'asc' ? 'сначала меньше' : 'сначала больше'})`;
            }
        }

        // Преобразование колонок
        const sqlColumns = columns.map(col => {
            const expression = COLUMN_MAPPING_DISH_SALES_REPORT[col];
            if (!expression) throw new Error(`Неизвестная колонка: ${col}`);
            return expression;
        });

        // Запрос данных
        const dataQuery = `
            SELECT 
                ${sqlColumns.join(', ')}
            ${baseQuery}
        `;

        // Запрос статистики
        const statsQuery = `
            SELECT
                SUM(sub."Количество") as "totalSold",
                SUM(sub."Сумма") as "totalRevenue"
            FROM (SELECT 
                    SUM(co."quantityOrder") as "Количество",
                    SUM(co."quantityOrder" * co."pricePerUnit") as "Сумма"
                ${baseQuery}) sub
            `;

        const [dataResult, statsResult] = await Promise.all([
            pool.query(dataQuery, queryParams),
            pool.query(statsQuery, queryParams)
        ]);

        // Формирование данных отчета
        const reportData = {
            reportType,
            filters: appliedFilters,
            columns: columns,
            data: dataResult.rows.map(row => ({
                ...row,
                Количество: parseInt(row.Количество),
                Цена: parseFloat(row.Цена?.toFixed(2)),
                Сумма: parseFloat(row.Сумма?.toFixed(2))
            })),
            stats: {
                "Всего продано": parseInt(statsResult.rows[0]?.totalSold) || '0',
                "Общая выручка": parseFloat(statsResult.rows[0]?.totalRevenue?.toFixed(2)) || '0'
            }
        };

        // Генерация файла
        if (req.query.format === 'pdf') {
            const pdfBuffer = await generatePDF(reportData);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment;`
            });
            res.send(Buffer.from(pdfBuffer));
        } else {
            const excelBuffer = await generateExcel(reportData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.send(excelBuffer);
        }
    } catch (error) {
        console.error('Ошибка генерации отчёта:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
}