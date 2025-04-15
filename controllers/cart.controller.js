// Контроллер для работы с корзиной

const pool = require('../config/db'); // Подключение к БД

// Получаем корзину и ее состав
exports.getCart = async (req, res) => {
    try {
        const userId = req.user.id; // ID пользователя из токена

        // Попробуем найти корзину пользователя
        const existingCart = await pool.query(
            `SELECT * FROM "shoppingCart" WHERE "accountId" = $1`,
            [userId]
        );

        let cart;
        if (existingCart.rows.length > 0) {
            // Если корзина существует, получаем её
            cart = existingCart.rows[0];
        } else {
            // Если корзина не найдена, создаем новую корзину
            const newCart = await pool.query(
                `INSERT INTO "shoppingCart" ("accountId", "costPrice") 
                 VALUES ($1, 0) 
                 RETURNING *`,
                [userId]
            );
            cart = newCart.rows[0];
        }

        // Получить состав корзины
        const composition = await pool.query(
            `SELECT c."dishId" as id, c.quantity
             FROM "compositionCart" c 
             JOIN dish d ON c."dishId" = d.id 
             WHERE "shoppingCartId" = $1`,
            [cart.id]
        );

        // Передаем корзину и ее данные
        res.json({
            cart,
            items: composition.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Добавить блюдо в корзину
exports.addItemCart = async (req, res) => {
    try {
        const userId = req.user.id; // ID пользователя из токена
        const { dishId, quantity } = req.body;

        // Найти корзину или создать новую, если её нет
        let cart = await pool.query(
            'SELECT id FROM "shoppingCart" WHERE "accountId" = $1',
            [userId]
        );

        const shoppingCartId = cart.rows[0].id;

        // Проверить, есть ли уже это блюдо в корзине
        const existingItem = await pool.query(
            `SELECT quantity FROM "compositionCart" 
             WHERE "shoppingCartId" = $1 AND "dishId" = $2`,
            [shoppingCartId, dishId]
        );

        if (existingItem.rows.length > 0) {
            // Если блюдо уже в корзине, обновляем количество
            await pool.query(
                `UPDATE "compositionCart" 
                 SET quantity = quantity + $1 
                 WHERE "shoppingCartId" = $2 AND "dishId" = $3`,
                [quantity, shoppingCartId, dishId]
            );
        } else {
            // Если блюда нет в корзине, добавляем его
            await pool.query(
                `INSERT INTO "compositionCart" ("shoppingCartId", "dishId", quantity)
                 VALUES ($1, $2, $3)`,
                [shoppingCartId, dishId, quantity]
            );
        }

        // Успешное добавление
        res.status(201).json({ message: 'Item added to cart' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Обновить кол-во блюд в корзине
exports.updateItemCart = async (req, res) => {
    try {
        const userId = req.user.id; // ID пользователя из токена
        const { quantity } = req.body;

        await pool.query(
            `UPDATE "compositionCart" 
             SET quantity = $1 
             WHERE "dishId" = $2 AND "shoppingCartId" = (
                 SELECT id FROM "shoppingCart" WHERE "accountId" = $3
             )`,
            [quantity, req.params.dishId, userId] // Параметры для запроса
        );

        // Успешное обновление кол-ва
        res.json({ message: 'Item updated' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Удалить блюдо из корзины
exports.removeItemCart = async (req, res) => {
    try {
        const userId = req.user.id; // ID пользователя из токена

        await pool.query(
            `DELETE FROM "compositionCart" 
             WHERE "dishId" = $1 AND "shoppingCartId" = (
                 SELECT id FROM "shoppingCart" WHERE "accountId" = $2
             )`,
            [req.params.dishId, userId] // Параметры для запроса
        );

        res.json({ message: 'Item removed' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};