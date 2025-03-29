// Контроллер для категорий

const pool = require('../config/db'); // Подключение к БД
const { getCategoriesQuery  } = require('../services/query.service');

// Получение полного списка категорий
exports.getAllCategories = async (req, res) => {
    try {
        const { rows } = await pool.query(getCategoriesQuery); // Получаем массив строк
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};