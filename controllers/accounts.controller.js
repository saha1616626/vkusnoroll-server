// Контроллер для работы с учетными записями

const pool = require('../config/db'); // Подключение к БД
const {
    getAccountsQuery,
    getAccountByIdQuery,
    getEmployeesQuery,
    getClientsQuery
} = require('../services/account.query.service'); // Запросы

// Получение учетной записи по ID
exports.getAccountById = async (req, res) => {
    try {
        const { rows } = await pool.query(getAccountByIdQuery, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Учетная запись не найдена' });
        }

        // Достаем запись о категории
        const account = rows[0];

        res.json(account);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Получение полного списка сотрудников
exports.getEmployees = async (req, res) => {
    try {
        const { rows } = await pool.query(getEmployeesQuery); // Получаем массив строк

        res.json(rows);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Получение полного списка пользователей
exports.getClients = async (req, res) => {
    try {
        const { rows } = await pool.query(getClientsQuery); // Получаем массив строк

        res.json(rows);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

