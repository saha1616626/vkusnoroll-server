// Контроллер для работы с ролями

const pool = require('../config/db'); // Подключение к БД
const {
    getRolesQuery
} = require('../services/role.query.service'); // Запросы

// Получение полного списка ролей
exports.getRoles = async (req, res) => {
    try {
        const { rows } = await pool.query(getRolesQuery); // Получаем массив строк
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};