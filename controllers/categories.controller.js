// Контроллер для категорий

const pool = require('../config/db'); // Подключение к БД
const {
    getCategoriesQuery,
    getСategoryByIdQuery,
    createСategoryQuery,
    updateСategoryQuery,
    deleteCategoriesQuery,
    archiveCategoriesQuery,
    checkCategoryUsageQuery
} = require('../services/query.service');

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

// Получение категории по ID
exports.getСategoryById = async (req, res) => {
    try {
        const { rows } = await pool.query(getСategoryByIdQuery, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Категория не найдена' });
        }

        // Достаем запись о категории
        const сategory = rows[0];

        res.json(сategory);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Создание новой категории
exports.createСategory = async (req, res) => {
    try {

        const { rows } = await pool.query(createСategoryQuery, [
            req.body.name,
            req.body.description,
            req.body.isArchived
        ]);

        res.status(201).json(rows[0]); // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Обновление категории
exports.updateСategory = async (req, res) => {
    try {

        const { rows } = await pool.query(updateСategoryQuery, [
            req.body.name,
            req.body.description,
            req.body.isArchived,
            req.params.id
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Категория не найдена' });
        }

        res.json(rows[0]);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Удаление списка категорий
exports.deleteCategories = async (req, res) => {
    try {
        const { ids } = req.body;

        // Валидация
        if (!ids || !Array.isArray(ids) || ids.length === 0) { // Проверка на существование данных, на массив, на длину массива
            return res.status(400).json({ error: 'Некорректный список ID' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        // Проверка использования категорий
        const { rows: usageRows } = await pool.query(
            checkCategoryUsageQuery,
            [numericIds]
        );

        // Разделение на конфликтные (есть зависимости в другой таблице) и разрешенные
        const conflicts = usageRows.filter(row => row.isUsed).map(row => row.name);
        const allowedIds = usageRows.filter(row => !row.isUsed).map(row => row.id);

        // Удаление разрешенных категорий
        let deleted = [];
        if (allowedIds.length > 0) {
            const { rows } = await pool.query(deleteCategoriesQuery, [allowedIds]);

            deleted = rows.map(row => row.name);
        }
        
        // Ответ
        if (conflicts.length > 0) {
            res.status(207).json({
                message: 'Частичное удаление',
                conflicts,
                deleted
            });
        } else {
            res.json({
                message: 'Все категории удалены',
                deleted
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

//  Архивировать или разархивировать список категорий
exports.archiveCategories = async (req, res) => {
    try {
        const { ids, archive } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0 || typeof archive !== 'boolean') { // Проверка на существование данных, на массив, на длину массива, на тип данных
            return res.status(400).json({ error: 'Некорректные параметры' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        const { rows } = await pool.query(archiveCategoriesQuery, [numericIds, archive]);
        res.json({
            message: archive ? 'Категории архивированы' : 'Категории извлечены из архива',
            updated: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};