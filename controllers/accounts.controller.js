// Контроллер для работы с учетными записями

const pool = require('../config/db'); // Подключение к БД
const {
    getAccountsQuery,
    getAccountByIdQuery,
    getEmployeesQuery,
    getClientsQuery,
    updateAccountQuery
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

// Обновление данных учетной записи клиентом (пользовательская часть)
exports.updateAccount = async (req, res) => {
    const { id } = req.params;
    const { name, numberPhone } = req.body;

    try {

        // Обновление данных
        const { rows } = await pool.query(updateAccountQuery, [
            name,
            numberPhone,
            id
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Убираем чувствительные данные из ответа
        const { password, confirmationСode, ...safeData } = rows[0];

        res.json(safeData);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера при обновлении данных' });
    }
}