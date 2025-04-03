// Контроллер для блюд

const pool = require('../config/db'); // Подключение к БД
const {
    getDishesQuery,
    getDishByIdQuery,
    createDishQuery,
    updateDishQuery
} = require('../services/query.service'); // Запросы

// Получение полного списка блюд
exports.getAllDishes = async (req, res) => {
    try {
        const { rows } = await pool.query(getDishesQuery); // Получаем массив строк
        res.json(rows);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Получение блюда по ID
exports.getDishById = async (req, res) => {
    try {
        const { rows } = await pool.query(getDishByIdQuery, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Блюдо не найдено' });
        }
        // res.json(rows[0]);  // Успешно


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
            req.body.image,
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