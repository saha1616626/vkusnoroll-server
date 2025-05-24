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
    checkUserActiveChatsQuery,
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
        const { rows } = await pool.query(checkUserActiveChatsQuery,
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
        const { rows: chatRows } = await client.query(checkUserActiveChatsQuery,
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
exports.sendEmployeeConfirmationCodeEmail = async (req, res) => {
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
        const { success } = await mailService.sendShiftConfirmation(email, code);
        if (!success) {
            throw new Error('Ошибка отправки письма');
        }

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
exports.verifyEmployeeConfirmationCodeEmail = async (req, res) => {
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

// Получение списка пользователей с пагинацией и фильтрами
exports.getClientsPaginationFilters = async (req, res) => {
    try {
        // Извлекаем параметры фильтрации и пагинации
        const {
            page = 1,
            limit = 100,
            numberPhone,
            name,
            isAccountTermination,
            search
        } = req.query;

        const offset = (page - 1) * limit; // Пагинация

        // Валидация пагинации
        if (isNaN(page) || isNaN(limit) || page < 1 || limit < 1) {
            return res.status(400).json({ error: 'Некорректные параметры пагинации' });
        }

        // Базовая часть запроса и условия фильтрации
        let baseQuery = `
            FROM account a
            JOIN role r ON a."roleId" = r.id
            WHERE r.name != 'Администратор' and r.name != 'Менеджер'
        `;

        const queryParams = [];
        let paramCounter = 1; // Счетчик параметров

        // Фильтрация по номеру телефона
        if (numberPhone) {
            baseQuery += ` AND a."numberPhone" ILIKE '%' || $${paramCounter++} || '%'`;
            queryParams.push(numberPhone.trim());
        }

        // Фильтрация по имени
        if (name) {
            baseQuery += ` AND a.name ILIKE '%' || $${paramCounter++} || '%'`;
            queryParams.push(name.trim());
        }

        // Фильтрация по доступу к учетной записи
        if (isAccountTermination) {
            if (isAccountTermination === 'Заблокирован') {
                baseQuery += ` AND a."isAccountTermination" = true`;
            } else {
                baseQuery += ` AND a."isAccountTermination" = false`;
            }
        }

        // Фильтация по запросу в поле поиска
        if (search) {
            baseQuery += ` AND a.email ILIKE '%' || $${paramCounter++} || '%'`;
            queryParams.push(search);
        }

        // Запрос ДЛЯ ПОДСЧЁТА количества (без LIMIT/OFFSET)
        const countQuery = `
            SELECT COUNT(*) as total
            ${baseQuery}
        `;

        // Запрос для данных
        const dataQuery = `
            SELECT
                a.id,
                a."roleId",
                r.name as role,
                a.name,
                a.surname,
                a.patronymic,
                a.email,
                a."numberPhone",
                a.login,
                a."password",
                a."registrationDate",
                a."confirmationСode",
                a."dateTimeСodeCreation",
                a."isAccountTermination",
                a."isEmailConfirmed",
                a."isOrderManagementAvailable", 
                a."isMessageCenterAvailable"
            ${baseQuery}
            LIMIT $${paramCounter++} OFFSET $${paramCounter++}
        `;

        // Параметры пагинации
        const paginationParams = [parseInt(limit), parseInt(offset)];
        const fullParams = [...queryParams, ...paginationParams];

        // Выполнение запроса
        const [dataResult, countResult] = await Promise.all([
            pool.query(dataQuery, fullParams),
            pool.query(countQuery, queryParams),
        ]);

        const total = parseInt(countResult.rows[0].total); // Кол-во строк без LIMIT и OFFSET

        res.json({ total, data: dataResult?.rows });  // Успешно
    } catch (error) {
        console.error('Ошибка при получении списка пользователей:', error);
        res.status(500).json({
            error: 'Ошибка сервера',
            details: error.message
        });
    }
}

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
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        const { email, password } = req.body;

        // Валидация входных данных
        if (!email || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        // Проверка существования email
        const emailCheck = await client.query(
            `SELECT EXISTS(SELECT 1 FROM account WHERE email = $1) AS "emailExists"`,
            [email]
        );
        if (emailCheck.rows[0].emailExists) {
            return res.status(400).json({ error: 'Email уже используется' });
        }

        // Получаем роль "Пользователь"
        const getUserRole = await client.query(`
            SELECT id FROM role WHERE name = 'Пользователь'
        `);

        let userRole; // Роль клиента
        if (getUserRole.rows.length > 0) {
            // Если роль существует, получаем её
            userRole = getUserRole.rows[0];
        } else {
            // Если роль не найдена, создаем новую
            const newUserRole = await client.query(
                `INSERT INTO role (name) VALUES ('Пользователь') RETURNING id`
            );
            userRole = newUserRole.rows[0];
        }

        const hashedPassword = await bcrypt.hash(password, 10); // Хеширование пароля

        const { rows } = await client.query(createAccountBuyerQuery, [
            userRole.id,
            email,
            hashedPassword, // Используем хешированный пароль
            false,  // isAccountTermination (не заблокирован)
            false,  // isEmailConfirmed (по умолчанию false)
            false,  // isOrderManagementAvailable
            false   // isMessageCenterAvailable
        ]);

        await client.query('COMMIT'); // Фиксация изменений
        res.status(201).json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK'); // Откат при ошибке
        console.error('Ошибка регистрации:', err);
        res.status(500).json({
            error: err.message || 'Ошибка сервера при регистрации'
        });
    } finally {
        client.release(); // Освобождение клиента
    }
};

// Отправка кода подтверждения на Email. Подтверждение почты клиента
exports.sendBuyerConfirmationCodeEmail = async (req, res) => {
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
        const { success } = await mailService.sendConfirmationRegistration(email, code);
        if (!success) {
            throw new Error('Ошибка отправки письма');
        }

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

// Проверка кода подтверждения отправеленного на Email почту клиента
exports.verifyBuyerConfirmationCodeEmail = async (req, res) => {
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

// Отправка кода подтверждения для восстановления пароля к учетной записи клиента
exports.sendCodeBuyerRecoveryPassword = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        const { email } = req.body;

        // Ищем пользователя по email
        const userCheck = await client.query(
            `SELECT *, a.id as "userId"
            FROM account a
            JOIN role r ON a."roleId" = r.id
            WHERE
                r.name = 'Пользователь'
                AND a.email = $1`,
            [email]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь с таким Email не найден' });
        }

        // Проверка подтверждения email
        if (!userCheck.rows[0].isEmailConfirmed) {
            return res.status(403).json({
                error: 'Требуется подтверждение Email',
                needsConfirmation: true,
                userId: userCheck.rows[0].userId // Id пользователя
            });
        }

        // Проверка, что код отправлен более минуты назад
        if (userCheck.rows[0].dateTimeСodeCreation) {
            const serverTime = new Date(userCheck.rows[0].dateTimeСodeCreation).getTime();

            // Рассчитываем оставшееся время до возможности запроса нового кода для подтверждения Email
            const now = Date.now();
            const timeDiff = now - serverTime;
            const remaining = Math.ceil((60 * 1000 - timeDiff) / 1000);

            if (remaining > 0) {
                return res.status(403).json({
                    error: 'Последний код был отправлен менее минуты назад. Подождите, чтобы запросить его снова',
                    dateTimeСodeCreation: userCheck.rows[0].dateTimeСodeCreation,
                    userId: userCheck.rows[0].userId // Id пользователя
                });
            }
        }

        const userId = userCheck.rows[0].userId;

        // Генерация и установка кода
        const code = generateConfirmationCode();
        const updateResult = await client.query(installingEmailConfirmationCodeQuery,
            [code, userId]
        );

        // Отправка письма
        const { success } = await mailService.sendCodeBuyerRecoveryPassword(email, code);
        if (!success) {
            throw new Error('Ошибка отправки письма');
        }

        await client.query('COMMIT');
        res.json({ success: true, dateTimeСodeCreation: updateResult.rows[0]?.dateTimeСodeCreation, userId: userCheck.rows[0].userId });
    } catch (err) {
        await client.query('ROLLBACK'); // Откат при ошибке
        console.error('Ошибка восстановления пароля:', err);
        res.status(500).json({
            error: err.message || 'Ошибка отправки кода восстановления'
        });
    } finally {
        client.release(); // Освобождаем клиент
    }
}

// Отправка кода подтверждения для восстановления пароля к учетной записи менеджера
exports.sendCodeManagerRecoveryPassword = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        const { email } = req.body;

        // Ищем пользователя по email
        const userCheck = await client.query(
            `SELECT *, a.id as "userId"
            FROM account a
            JOIN role r ON a."roleId" = r.id
            WHERE
                r.name = 'Менеджер'
                AND a.email = $1`,
            [email]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь с таким Email не найден' });
        }

        // Проверка подтверждения email
        if (!userCheck.rows[0].isEmailConfirmed) {
            return res.status(403).json({
                error: 'Учетная запись не подтверждена, обращайтесь к администратору',
            });
        }

        // Проверка, что код отправлен более минуты назад
        if (userCheck.rows[0].dateTimeСodeCreation) {
            const serverTime = new Date(userCheck.rows[0].dateTimeСodeCreation).getTime();

            // Рассчитываем оставшееся время до возможности запроса нового кода для подтверждения Email
            const now = Date.now();
            const timeDiff = now - serverTime;
            const remaining = Math.ceil((60 * 1000 - timeDiff) / 1000);

            if (remaining > 0) {
                return res.status(403).json({
                    error: 'Последний код был отправлен менее минуты назад. Подождите, чтобы запросить его снова',
                    dateTimeСodeCreation: userCheck.rows[0].dateTimeСodeCreation,
                    userId: userCheck.rows[0].userId // Id пользователя
                });
            }
        }

        const userId = userCheck.rows[0].userId;

        // Генерация и установка кода
        const code = generateConfirmationCode();
        const updateResult = await client.query(installingEmailConfirmationCodeQuery,
            [code, userId]
        );

        // Отправка письма
        // const { success } = await mailService.sendCodeBuyerRecoveryPassword(email, code);
        // if (!success) {
        //     throw new Error('Ошибка отправки письма');
        // }

        await client.query('COMMIT');
        res.json({ success: true, dateTimeСodeCreation: updateResult.rows[0]?.dateTimeСodeCreation, userId: userCheck.rows[0].userId });
    } catch (err) {
        await client.query('ROLLBACK'); // Откат при ошибке
        console.error('Ошибка восстановления пароля:', err);
        res.status(500).json({
            error: err.message || 'Ошибка отправки кода восстановления'
        });
    } finally {
        client.release(); // Освобождаем клиент
    }
}

// Отправка кода подтверждения для восстановления пароля к учетной записи администратора
exports.sendCodeAdministratorRecoveryPassword = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        const { email } = req.body;

        // Ищем пользователя по email
        const userCheck = await client.query(
            `SELECT *, a.id as "userId"
            FROM account a
            JOIN role r ON a."roleId" = r.id
            WHERE
                r.name = 'Администратор'
                AND a.email = $1`,
            [email]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь с таким Email не найден' });
        }

        // Проверка подтверждения email
        if (!userCheck.rows[0].isEmailConfirmed) {
            return res.status(403).json({
                error: 'Учетная запись не подтверждена, обращайтесь к администратору',
            });
        }

        // Проверка, что код отправлен более минуты назад
        if (userCheck.rows[0].dateTimeСodeCreation) {
            const serverTime = new Date(userCheck.rows[0].dateTimeСodeCreation).getTime();

            // Рассчитываем оставшееся время до возможности запроса нового кода для подтверждения Email
            const now = Date.now();
            const timeDiff = now - serverTime;
            const remaining = Math.ceil((60 * 1000 - timeDiff) / 1000);

            if (remaining > 0) {
                return res.status(403).json({
                    error: 'Последний код был отправлен менее минуты назад. Подождите, чтобы запросить его снова',
                    dateTimeСodeCreation: userCheck.rows[0].dateTimeСodeCreation,
                    userId: userCheck.rows[0].userId // Id пользователя
                });
            }
        }

        const userId = userCheck.rows[0].userId;

        // Генерация и установка кода
        const code = generateConfirmationCode();
        const updateResult = await client.query(installingEmailConfirmationCodeQuery,
            [code, userId]
        );

        // Отправка письма
        const { success } = await mailService.sendCodeBuyerRecoveryPassword(email, code);
        if (!success) {
            throw new Error('Ошибка отправки письма');
        }

        await client.query('COMMIT');
        res.json({ success: true, dateTimeСodeCreation: updateResult.rows[0]?.dateTimeСodeCreation, userId: userCheck.rows[0].userId });
    } catch (err) {
        await client.query('ROLLBACK'); // Откат при ошибке
        console.error('Ошибка восстановления пароля:', err);
        res.status(500).json({
            error: err.message || 'Ошибка отправки кода восстановления'
        });
    } finally {
        client.release(); // Освобождаем клиент
    }
}

// Проверка кода подтверждения, отправленного на email при восстановлении пароля
exports.checkingCodeResettingPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { code } = req.body;

        // Валидация формата кода (только цифры)
        if (!/^\d{6}$/.test(code)) {
            return res.status(400).json({ error: "Неверный формат кода" });
        }

        // Выполнение запроса к БД
        const result = await pool.query(`
            SELECT *
            FROM account 
            WHERE id = $1 
            AND "confirmationСode" = $2 
            AND "dateTimeСodeCreation" > NOW() - INTERVAL '1 hours'`,
            [id, code]);

        if (result.rowCount === 0) {
            // Защита от временных атак - фиксированное время ответа
            await new Promise(resolve => setTimeout(resolve, 500));
            return res.status(400).json({
                error: "Неверный код или срок действия истек"
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Ошибка верификации:", err);
        res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
};

// Смена пароля
exports.changingPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        // Валидация
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
        }

        const hashedPassword = await bcrypt.hash(password, 10); // Хеширование пароля

        // Выполнение запроса к БД
        const result = await pool.query(`
            UPDATE account 
            SET password = $1,
                "confirmationСode" = NULL,
                "dateTimeСodeCreation" = NULL 
            WHERE id = $2
            RETURNING id`,
            [hashedPassword, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Ошибка смены пароля:", err);
        res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
}