// Контроллер для работы с заказами 

const pool = require('../config/db'); // Подключение к БД
const {

} = require('../services/orders.query.service'); // Запросы

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
        const ordersResult = await client.query(ordersQuery, [req.params.accountId]);
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
            RETURNING id, "orderNumber"
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