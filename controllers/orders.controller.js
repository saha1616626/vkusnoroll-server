// Контроллер для работы с заказами 

const pool = require('../config/db'); // Подключение к БД
const {broadcastNewOrder} = require('./../websocket'); // Метод Websocket
const {
} = require('../services/orders.query.service'); // Запросы

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
        } = req.query; // Пагинация

        const offset = (page - 1) * limit;

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
            // Если есть статус с id === null, то отделяем его
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

}

// Создать заказ для клиента
exports.createOrder = async (req, res) => {

}

// Обновить заказ
exports.updateOrder = async (req, res) => {

}

// Удалить заказ(ы)
exports.deleteOrders = async (req, res) => {

}

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
        } catch (error) {}

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