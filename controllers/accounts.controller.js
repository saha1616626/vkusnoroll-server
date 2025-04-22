// Контроллер для работы с учетными записями

const pool = require('../config/db'); // Подключение к БД
const {
    getAccountsQuery,
    getAccountByIdQuery,
    getEmployeesQuery,
    createEmployeQuery,
    getClientsQuery,
    updateAccountBuyerQuery,
    createAccountBuyerQuery,
    checkEmailForUniqueGivenRoleQuery
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

// Создание учетной записи сотрудника 
exports.createEmploye = async (req, res) => {

    const { email, roleId } = req.body;
    try {
        // Проверка уникальности Email для роли
        const checkResult = await pool.query(
            checkEmailForUniqueGivenRoleQuery,
            [email, roleId]
        );

        if (checkResult.rows[0].emailExists) {
            return res.status(400).json({
                error: 'Email уже используется для этой роли'
            });
        }

        // Проверка уникальности логина

        // Создание сотрудника
        const { rows } = await pool.query(createEmployeQuery, [
            roleId,
            req.body.name,
            req.body.surname,
            req.body.patronymic,
            email,
            req.body.numberPhone,
            req.body.login,
            req.body.password,
            req.body.isAccountTermination,
            req.body.isOrderManagementAvailable,
            req.body.isMessageCenterAvailable
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при создании сотрудника'
        });
    }
};

// Удаление учетной записи сотрудника
exports.deleteEmploye = async (req, res) => {
    try {

        // TODO
        // Не забываем перевести все открытые чаты в состояие закрыты для данного пользователя (при наличии).
        // Предупреждаем администратора, что при удалении все чаты станут не принятыми c сохранением истории переписки. Или закрываем чаты и уведомляем пользователей в ТГ о закрытии линии.
        // Создаем триггер на действие удаление account, accountId = null, isChatAccepted = false, 

    } catch (err) {

    }
}

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
exports.updateAccountBuyer = async (req, res) => {
    const { id } = req.params;
    const { name, numberPhone } = req.body;

    try {

        // Обновление данных
        const { rows } = await pool.query(updateAccountBuyerQuery, [
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

// Создание (регистрация) учетной записи клиента (пользовательская часть)
exports.createAccountBuyer = async (req, res) => {

    // Получаем пользовательскую роль
    const getUserRole = await pool.query(`SELECT id as role
        FROM role
        WHERE name = 'Пользователь'`);

    let userRole; // Роль клиента
    if (getUserRole.rows.length > 0) {
        // Если роль существует, получаем её
        userRole = getUserRole.rows[0];
    } else {
        // Если роль не найдена, создаем новую
        const newUserRole = await pool.query(
            `INSERT INTO role 
             VALUES ('Пользователь')`
        );
        userRole = newUserRole.rows[0];
    }

    const { rows: rows } = await pool.query(createAccountBuyerQuery,
        [
            userRole.id,
            req.body.email,
            req.body.password
        ]
    );

    res.status(201).json(rows[0]);
};