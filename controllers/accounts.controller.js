// Контроллер для работы с учетными записями

const pool = require('../config/db'); // Подключение к БД
const {
    getAccountsQuery,
    updateEmailQuery,
    getAccountByIdQuery,
    getEmployeesQuery,
    createEmployeQuery,
    getClientsQuery,
    updateAccountBuyerQuery,
    createAccountBuyerQuery,
    checkEmailForUniqueGivenRoleQuery,
    checkLoginForUniqueQuery,
    installingEmailConfirmationCodeQuery,
    verificationConfirmationCodeQuery,
    checkUserActiveСhatsQuery,
    updatingChatsAfterAccountDeletion,
    updateEmployeQuery,
    updateClientQuery
} = require('../services/account.query.service'); // Запросы
const mailService = require('../services/mail/mail.service'); // Подключение к почтовому серверу
const crypto = require('crypto'); // Модуль crypto
const bcrypt = require('bcrypt'); // Шифрование пароля

// Криптографически безопасный генератор кода для email
const generateConfirmationCode = () => {
    return crypto.randomInt(100000, 999999); // 6-значный код
};

// Получение учетной записи по ID для WebSocket 
exports.getAccountByIdForWebSocket = async (userId) => {
    const { rows } = await pool.query(`SELECT 
    a.id, 
    a.name, 
    r.name as role, 
    a."isOrderManagementAvailable",
    a."isMessageCenterAvailable",
    a."isAccountTermination"
    FROM account a 
    JOIN role r ON a."roleId" = r.id
    WHERE a.id = $1`,
        [userId]);
    return rows[0] || null;
};

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

// Обновление email учетной записи
exports.updateEmail = async (req, res) => {
    const { email } = req.body;
    try {
        // Проверка уникальности Email во всей системе за исключением текущего обновляемого пользователя
        const checkResult = await pool.query(`
            SELECT EXISTS(
                SELECT 1 
                FROM account 
                WHERE email = $1 AND id != $2
            ) AS "emailExists";`,
            [email, req.params.id]
        );

        if (checkResult.rows[0].emailExists) {
            return res.status(400).json({
                error: 'Email уже используется'
            });
        }

        // Обновление сотрудника
        const { rows } = await pool.query(updateEmailQuery, [
            email,
            req.params.id
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при обновлении сотрудника'
        });
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

    const { email, roleId, login } = req.body;
    try {
        // Поверка уникальности Email во всей системе
        const checkResult = await pool.query(
            checkEmailForUniqueGivenRoleQuery,
            [email]
        );

        if (checkResult.rows[0].emailExists) {
            return res.status(400).json({
                error: 'Email уже используется'
            });
        }

        // Проверка уникальности логина
        const checkLoginResult = await pool.query(
            checkLoginForUniqueQuery,
            [login]
        );

        if (checkLoginResult.rows[0].loginExists) {
            return res.status(400).json({ error: 'Логин уже используется' });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10); // Шифрование пароля

        // Создание сотрудника
        const { rows } = await pool.query(createEmployeQuery, [
            roleId,
            req.body.name,
            req.body.surname,
            req.body.patronymic,
            email,
            req.body.numberPhone,
            login,
            hashedPassword,
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

// Обновление учетной записи
exports.updateEmploye = async (req, res) => {

    const { email, roleId, login } = req.body;
    try {
        // Проверка уникальности Email во всей системе за исключением текущего обновляемого пользователя
        const checkResult = await pool.query(`
            SELECT EXISTS(
                SELECT 1 
                FROM account 
                WHERE email = $1 AND id != $2
            ) AS "emailExists";`,
            [email, req.params.id]
        );

        if (checkResult.rows[0].emailExists) {
            return res.status(400).json({
                error: 'Email уже используется'
            });
        }

        // Проверка уникальности логина за исключением текущего обновляемого пользователя
        const checkLoginResult = await pool.query(`
            SELECT EXISTS(
                SELECT 1 
                FROM account 
                WHERE login = $1 AND id != $2
            ) AS "loginExists";
            `,
            [login, req.params.id]
        );

        if (checkLoginResult.rows[0].loginExists) {
            return res.status(400).json({ error: 'Логин уже используется' });
        }

        // Обновление сотрудника
        const { rows } = await pool.query(updateEmployeQuery, [
            roleId,
            req.body.name,
            req.body.surname,
            req.body.patronymic,
            email,
            req.body.numberPhone,
            login,
            req.body.isAccountTermination,
            req.body.isOrderManagementAvailable,
            req.body.isMessageCenterAvailable,
            req.params.id
        ]);

        // TODO Если аккаунт заблокирован или ограничен Центром сообщений + есть незаверешенные чаты, то необходимо открытые чаты перевести в раздел непринятых
        // Метод updatingChatsAfterAccountDeletion не подойдет, так как нужно id заменять на Null, а при удалении сотрудника автомат выстав null

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при обновлении сотрудника'
        });
    }
};

// Количество незавершенных чатов у выбранного пользователя
exports.checkActiveChats = async (req, res) => {
    try {
        const { rows } = await pool.query(checkUserActiveСhatsQuery,
            [req.params.id]
        );

        res.json({ activeChats: parseInt(rows[0].activeChats) });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка проверки чатов' });
    }
}

// Удаление учетной записи сотрудника
exports.deleteEmploye = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        // Проверка активных чатов
        const { rows: chatRows } = await client.query(checkUserActiveСhatsQuery,
            [req.params.id]
        );

        // Обновление чатов
        await client.query(updatingChatsAfterAccountDeletion,
            [req.params.id]
        );

        // Удаление аккаунта
        await client.query(
            `DELETE FROM account WHERE id = $1`,
            [req.params.id]
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            activeChats: parseInt(chatRows[0].activeChats)
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления:', err);
        res.status(500).json({
            error: err.message || 'Ошибка при удалении сотрудника'
        });
    } finally {
        client.release();
    }
};

// Отправка кода подтверждения на Email. Подтверждение почты сотрудника
exports.sendEmployeeСonfirmationСodeEmail = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        // Генерация и установка кода
        const code = generateConfirmationCode();
        const updateResult = await client.query(installingEmailConfirmationCodeQuery,
            [code, req.params.id]
        );

        // Получаем email из БД
        const email = updateResult.rows[0]?.email;
        if (!email) {
            throw new Error('Аккаунт не найден');
        }

        // Отправка письма
        // const { success } = await mailService.sendShiftConfirmation(email, code);
        // if (!success) {
        //     throw new Error('Ошибка отправки письма');
        // }

        await client.query('COMMIT');
        res.json({ success: true, dateTimeСodeCreation: updateResult.rows[0]?.dateTimeСodeCreation });
    } catch (err) {
        await client.query('ROLLBACK'); // Откат при ошибке
        res.status(500).json({
            error: err.message || 'Ошибка отправки кода'
        });
    } finally {
        client.release(); // Освобождаем клиент
    }
};

// Проверка кода подтверждения отправеленного на Email почты сотрудника
exports.verifyEmployeeСonfirmationСodeEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { code } = req.body;

        // Проверка типа кода
        if (typeof code !== 'string') {
            return res.status(400).json({ error: "Код должен быть строкой" });
        }

        // Выполнение запроса к БД
        const { rows } = await pool.query(verificationConfirmationCodeQuery, [id, code]);

        if (rows.length === 0) {
            return res.status(400).json({
                error: 'Неверный код или срок действия истек'
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Ошибка верификации:", err);
        res.status(500).json({ error: "Внутренняя ошибка сервера" });
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

// Обновление клиентского аккаунта (админ часть)
exports.updateClient = async (req, res) => {
    try {

        // Обновление клиентского аккаунта
        const { rows } = await pool.query(updateClientQuery, [
            req.body.isAccountTermination,
            req.params.id
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при обновлении пользователя'
        });
    }
}

// Удаление клиентского аккаунта (админ часть)
exports.deleteClient = async (req, res) => {
    try {

        // Удаление аккаунта
        await pool.query(
            `DELETE FROM account WHERE id = $1`,
            [req.params.id]
        );
        res.json({
            success: true
        });
    } catch (err) {
        console.error('Ошибка удаления:', err);
        res.status(500).json({
            error: err.message || 'Ошибка при удалении пользователя'
        });
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
            numberPhone || null,
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