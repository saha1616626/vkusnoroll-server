// Контроллер для настройки рабочего времени ресторана

const pool = require('../config/db');
const {
    createRestaurantWorkingTimeQuery,
    checkDeliveryDateQuery,
    checkDeliveryDateUpdateQuery,
    updateRestaurantWorkingTimeQuery,
    deleteRestaurantWorkingTimeQuery,
    getDeliveryTimeByDateQuery
} = require('../services/deliveryWork.service'); // Запросы

// Получить список рабочего времени ресторана
exports.getListRestaurantWorkingTime = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM "deliveryWork" ORDER BY "date"');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Создать элемент рабочего времени
exports.createRestaurantWorkingTime = async (req, res) => {
    try {
        const { date } = req.body;

        // Проверка, что дата еще не занята в графике работы
        const checkResult = await pool.query(
            checkDeliveryDateQuery,
            [date]
        );

        if (checkResult.rows[0].dateExists) {
            return res.status(400).json({
                error: 'График работы на эту дату уже установлен'
            });
        }

        // Создание нового графика
        const { rows } = await pool.query(createRestaurantWorkingTimeQuery, [
            req.body.date,
            req.body.isWorking,
            req.body.startDeliveryWorkTime,
            req.body.endDeliveryWorkTime
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при создании элемента графика рабочего времени'
        });
    }
}

// Обновить элемент рабочего времени
exports.updateRestaurantWorkingTime = async (req, res) => {
    try {
        const { date } = req.body;

        // Проверка, что дата еще не занята в графике работы
        const checkResult = await pool.query(
            checkDeliveryDateUpdateQuery,
            [date, req.params.id]
        );

        if (checkResult.rows[0].dateExists) {
            return res.status(400).json({
                error: 'График работы на эту дату уже установлен'
            });
        }

        // Обновление графика
        const { rows } = await pool.query(updateRestaurantWorkingTimeQuery, [
            req.body.date,
            req.body.isWorking,
            req.body.startDeliveryWorkTime,
            req.body.endDeliveryWorkTime,
            req.params.id
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при создании элемента графика рабочего времени'
        });
    }
}

// Удалить элемент(ы) рабочего времени
exports.deleteRestaurantWorkingTime = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) { // Проверка на существование данных, на массив, на длину массива
            return res.status(400).json({ error: 'Некорректный список ID' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        await client.query(deleteRestaurantWorkingTimeQuery, [numericIds]); // Передаем список id для удаления

        await client.query('COMMIT');
        res.json({ message: 'Элементы графика рабочего времени успешно удалены', success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка удаления:', err);
        res.status(500).json({
            error: err.message || 'Ошибка при удалении элементов графика рабочего времени'
        });
    } finally {
        client.release();
    }
}

// Получить стандартное рабочее время
exports.getDefaultWorkingTime = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT value FROM "appSetting" WHERE key = $1',
            ['delivery_default_time']
        );

        res.json(rows[0]?.value || { start: '10:00', end: '22:00' }); // Если время не стоит, ставим по умолчанию значение
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Обновить стандартное рабочее время
exports.updateDefaultWorkingTime = async (req, res) => {
    try {
        const { start, end } = req.body;

        // Валидация времени
        if (!req.body.start || !req.body.end) {
            return res.status(400).json({ error: "Отсутствуют обязательные поля" });
        }

        await pool.query(`
            INSERT INTO "appSetting" (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value
        `, ['delivery_default_time', JSON.stringify({ start, end })]);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Получение времени работы доставки на конкретную дату
exports.getDeliveryTimeByDate = async (req, res) => {
    try {
        const { date } = req.body; // Извлекаем дату из тела запроса

        // Поиск расписания для текущей даты
        const { rows: scheduleRows } = await pool.query(getDeliveryTimeByDateQuery,
            [date]
        );

        // Если найдено специальное расписание
        if (scheduleRows.length > 0) {
            return res.json({
                isWorking: scheduleRows[0].isWorking,
                startDeliveryWorkTime: scheduleRows[0].startDeliveryWorkTime,
                endDeliveryWorkTime: scheduleRows[0].endDeliveryWorkTime
            });
        }

        // Получение стандартного времени
        const { rows: defaultTimeRows } = await pool.query(
            `SELECT 
                value->>'start' AS start, 
                value->>'end' AS end 
            FROM "appSetting" 
            WHERE key = 'delivery_default_time'`
        );

        // Возвращаем результат
        if (defaultTimeRows.length > 0) {
            return res.json({
                isWorking: true,
                startDeliveryWorkTime: defaultTimeRows[0].start,
                endDeliveryWorkTime: defaultTimeRows[0].end,
            });
        }

        // Значение по умолчанию если ничего не найдено
        res.json({
            isWorking: true,
            startDeliveryWorkTime: '10:00',
            endDeliveryWorkTime: '22:00'
        });
    } catch (error) {
        console.error('Ошибка получения времени доставки:', error);
        res.status(500).json({
            error: 'Не удалось получить время доставки',
            details: error.message
        });
    }
}

// Получение актуального времени доставки
exports.getCurrentDeliveryTime = async (req, res) => {
    try {
        // Получаем текущую дату в часовом поясе БД
        const { rows: currentDateRows } = await pool.query(
            `SELECT CURRENT_DATE AS "currentDate"`
        );
        const currentDate = currentDateRows[0].currentDate.toISOString();

        // Поиск расписания для текущей даты
        const { rows: scheduleRows } = await pool.query(
            `SELECT 
                "isWorking",
                "startDeliveryWorkTime" AS "start", 
                "endDeliveryWorkTime" AS "end"
             FROM "deliveryWork"
             WHERE date = $1`,
            [currentDate]
        );

        // Если найдено специальное расписание
        if (scheduleRows.length > 0) {
            return res.json({
                isWorking: scheduleRows[0].isWorking,
                start: scheduleRows[0].start,
                end: scheduleRows[0].end,
                isCustom: true
            });
        }

        // Получение стандартного времени
        const { rows: defaultTimeRows } = await pool.query(
            `SELECT 
                value->>'start' AS start, 
                value->>'end' AS end 
            FROM "appSetting" 
            WHERE key = 'delivery_default_time'`
        );

        // Возвращаем результат
        if (defaultTimeRows.length > 0) {
            return res.json({
                isWorking: true,
                start: defaultTimeRows[0].start,
                end: defaultTimeRows[0].end,
                isCustom: false
            });
        }

        // Значение по умолчанию если ничего не найдено
        res.json({
            isWorking: true,
            start: '10:00',
            end: '22:00',
            isCustom: false
        });

    } catch (error) {
        console.error('Ошибка получения времени доставки:', error);
        res.status(500).json({
            error: 'Не удалось получить время доставки',
            details: error.message
        });
    }
};