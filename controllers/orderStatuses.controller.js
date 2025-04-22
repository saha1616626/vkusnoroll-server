// Контроллер для управления статусами заказов


const pool = require('../config/db');

// Получить список статусов
exports.getStatuses = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM "orderStatus" ORDER BY "sequenceNumber"');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Получить статус заказа по Id
exports.getStatusById = async (req, res) => {
    try {
        const { rows: rows } = await pool.query('SELECT * FROM "orderStatus" WHERE id = $1', [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Сохнарить новый статус заказа
exports.createStatus = async (req, res) => {
    try {
        const { isFinalResultPositive } = req.body;

        // Проверка на попытку создания второго финального статуса
        if (isFinalResultPositive === true) {
            const existingFinalStatus = await pool.query(
                'SELECT id FROM "orderStatus" WHERE "isFinalResultPositive" = true'
            );

            // Если такой тип статуса есть
            if (existingFinalStatus.rows.length > 0) {
                return res.status(400).json({
                    error: 'Финальный положительный статус может быть только один',
                    conflicts: ['Уже существует статус с положительным финальным результатом']
                });
            }
        }

        // Получаем максимальный порядковый номер
        const sequenceNumber = await pool.query('SELECT MAX("sequenceNumber") AS max_sequence FROM "orderStatus"');

        const { rows: rows } = await pool.query(`INSERT INTO "orderStatus"(
            name, "sequenceNumber", "isFinalResultPositive", "isAvailableClient") 
            VALUES ($1, $2, $3, $4)
            RETURNING *`,
            [
                req.body.name,
                sequenceNumber.rows[0].max_sequence + 1,
                isFinalResultPositive,
                req.body.isAvailableClient
            ]
        );

        res.status(201).json(rows[0]); // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Обновить статус заказа
exports.updateStatus = async (req, res) => {
    try {
        const { isFinalResultPositive } = req.body;

        // Проверка на попытку обновления финального статуса при наличии уже других статусов с таким типом
        if (isFinalResultPositive === true) {
            const existingFinalStatus = await pool.query(
                'SELECT id FROM "orderStatus" WHERE "isFinalResultPositive" = true AND "orderStatus".id != $1',
                [req.params.id]
            );

            // Если такой тип статуса есть (кроме текущего статуса)
            if (existingFinalStatus.rows.length > 0) {
                return res.status(400).json({
                    error: 'Финальный положительный статус может быть только один',
                    conflicts: ['Уже существует статус с положительным финальным результатом']
                });
            }
        }

        const { rows } = await pool.query(`UPDATE "orderStatus" SET
            name = $1, "sequenceNumber" = $2, "isFinalResultPositive" = $3, "isAvailableClient" = $4
            WHERE id = $5
            RETURNING *`,
            [req.body.name, req.body.sequenceNumber, isFinalResultPositive, req.body.isAvailableClient, req.params.id])

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Статус не найден' });
        }

        res.json(rows[0]);  // Успешно
    } catch (err) {
        if (err.code === '23503') { // Код ошибки внешнего ключа
            return res.status(409).json({
                conflicts: ['Неизвестные зависимые записи'],
                message: "Обнаружены скрытые зависимости"
            });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Удалить статус заказа
exports.deleteStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) { // Проверка на существование id
            return res.status(400).json({ error: 'Некорректный ID' });
        }

        // Удаление статуса
        const { rows } = await pool.query(
            `DELETE FROM "orderStatus" WHERE id = $1 RETURNING *`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Статус не найден' });
        }

        // Успешный ответ
        res.json({
            message: 'Статус успешно удален',
            deleted: rows[0]
        });
    } catch (err) {
        // Обработка ошибки внешнего ключа
        if (err.code === '23503') {
            return res.status(409).json({
                conflicts: ['Статус используется в заказах'],
                message: "Нельзя удалить используемый статус"
            });
        }

        // Общая обработка ошибок (только если ответ еще не отправлен)
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                details: err.message
            });
        }
    }
}

// Обновление последовательности статусов
exports.updateSequence = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        const { sequence } = req.body;
        await client.query('BEGIN'); // Начало транзакции

        // Параллельное выполнение обновлений внутри транзакции
        await Promise.all(
            sequence.map(({ id, sequenceNumber }) =>
                client.query(
                    'UPDATE "orderStatus" SET "sequenceNumber" = $1 WHERE id = $2',
                    [sequenceNumber, id]
                )
            ));

        await client.query('COMMIT'); // Фиксация транзакции
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK'); // Откат при ошибке
        res.status(500).json({
            error: error.message,
            details: "Ошибка при обновлении последовательности статусов"
        });
    } finally {
        client.release(); // Освобождаем клиент
    }
};