// Контроллер для блюд

const pool = require('../config/db'); // Подключение к БД
const { getDishesQuery  } = require('../services/query.service');

// Получение полного списка блюд
exports.getAllDishes = async (req, res) => {
    try {
        const { rows } = await pool.query(getDishesQuery); // Получаем массив строк
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};