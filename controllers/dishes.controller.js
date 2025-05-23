// Контроллер для блюд

const pool = require('../config/db'); // Подключение к БД
const {
    getDishesQuery,
    getUnarchivedDishesNoImageWithActiveCategoryQuery,
    getDishByIdQuery,
    createDishQuery,
    updateDishQuery,
    deleteDishesQuery,
    archiveDishesQuery,
    checkDishesUsageQuery
} = require('../services/query.service'); // Запросы

// Получение полного списка блюд
exports.getAllDishes = async (req, res) => {
    try {
        const { rows } = await pool.query(getDishesQuery); // Получаем массив строк

        // Перебираем каждую запись в массиве
        for (const dish of rows) {
            // Если есть Buffer с изображением, конвертируем в base64
            if (dish.image && Buffer.isBuffer(dish.image)) {
                dish.image = `data:image/png;base64,${dish.image.toString('base64')}`;
            }
        }

        res.json(rows);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Получение списка блюд без изображения и те товары, которые не в архиве, и их категория не в архиве
exports.getUnarchivedDishesNoImageWithActiveCategory = async (req, res) => {
    try {
        const { rows } = await pool.query(getUnarchivedDishesNoImageWithActiveCategoryQuery); // Получаем массив строк

        res.json(rows);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка получения блюд' });
    }
}

// Получение блюда по ID
exports.getDishById = async (req, res) => {
    try {
        const { rows } = await pool.query(getDishByIdQuery, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Блюдо не найдено' });
        }

        // Достаем запись о блюде
        const dish = rows[0];

        // Если есть Buffer с изображением, конвертируем в base64
        if (dish.image && Buffer.isBuffer(dish.image)) {
            dish.image = `data:image/png;base64,${dish.image.toString('base64')}`;
        }

        res.json(dish);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Создание нового блюда
exports.createDish = async (req, res) => {
    try {
        // Конвертация изображения в чистый base64
        const base64Data = req.body.image;
        const buffer = Buffer.from(base64Data, 'base64');

        const { rows } = await pool.query(createDishQuery, [
            req.body.name,
            req.body.description,
            req.body.categoryId,
            req.body.isNutritionalValue,
            req.body.calories,
            req.body.fats,
            req.body.squirrels,
            req.body.carbohydrates,
            req.body.isWeight,
            req.body.weight,
            req.body.isQuantitySet,
            req.body.quantity,
            req.body.isVolume,
            req.body.volume,
            req.body.price,
            req.body.isArchived,
            req.body.image = buffer
        ]);

        res.status(201).json(rows[0]); // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Обновление блюда
exports.updateDish = async (req, res) => {
    try {
        // Конвертация изображения в чистый base64
        const base64Data = req.body.image;
        const buffer = Buffer.from(base64Data, 'base64');

        const { rows } = await pool.query(updateDishQuery, [
            req.body.name,
            req.body.description,
            req.body.categoryId,
            req.body.isNutritionalValue,
            req.body.calories,
            req.body.fats,
            req.body.squirrels,
            req.body.carbohydrates,
            req.body.isWeight,
            req.body.weight,
            req.body.isQuantitySet,
            req.body.quantity,
            req.body.isVolume,
            req.body.volume,
            req.body.price,
            req.body.isArchived,
            req.body.image = buffer,
            req.params.id
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Блюдо не найдено' });
        }

        res.json(rows[0]);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Удаление списка блюд
exports.deleteDishes = async (req, res) => {
    try {
        const { ids } = req.body;

        // Валидация
        if (!ids || !Array.isArray(ids) || ids.length === 0) { // Проверка на существование данных, на массив, на длину массива
            return res.status(400).json({ error: 'Некорректный список ID' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        // Проверка использования блюд
        const { rows: usageRows } = await pool.query(
            checkDishesUsageQuery,
            [numericIds]
        );

        // Разделение на конфликтные (есть зависимости в другой таблице) и разрешенные
        const conflicts = usageRows.filter(row => row.isUsed).map(row => row.name);
        const allowedIds = usageRows.filter(row => !row.isUsed).map(row => row.id);

        // Удаление разрешенных блюд
        let deleted = [];
        if (allowedIds.length > 0) {
            const { rows } = await pool.query(deleteDishesQuery, [allowedIds]);

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
                message: 'Все блюда удалены',
                deleted
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

//  Архивировать или разархивировать список блюд
exports.archiveDishes = async (req, res) => {
    try {
        const { ids, archive } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0 || typeof archive !== 'boolean') { // Проверка на существование данных, на массив, на длину массива, на тип данных
            return res.status(400).json({ error: 'Некорректные параметры' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        const { rows } = await pool.query(archiveDishesQuery, [numericIds, archive]);
        res.json({
            message: archive ? 'Блюда архивированы' : 'Блюда извлечены из архива',
            updated: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};