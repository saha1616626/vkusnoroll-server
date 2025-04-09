// Контроллер для новостей

const pool = require('../config/db'); // Подключение к БД
const {
    getNewsPostsQuery,
    getNewsPostByIdQuery,
    createNewsPostQuery,
    updateNewsPostQuery,
    deleteNewsPostsQuery,
    archiveNewsPostsQuery
} = require('../services/query.service'); // Запросы

// Получение полного списка новостей
exports.getAllNewsPosts = async (req, res) => {
    try {
        const { rows } = await pool.query(getNewsPostsQuery); // Получаем массив строк

        // Перебираем каждую запись в массиве
        for (const newsPost of rows) {
            // Если есть Buffer с изображением, конвертируем в base64
            if (newsPost.image && Buffer.isBuffer(newsPost.image)) {
                newsPost.image = `data:image/png;base64,${newsPost.image.toString('base64')}`;
            }
        }

        res.json(rows);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Получение новости по ID
exports.getNewsPostById = async (req, res) => {
    try {
        const { rows } = await pool.query(getNewsPostByIdQuery, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Пост не найден' });
        }

        // Достаем запись о блюде
        const newsPost = rows[0];

        // Если есть Buffer с изображением, конвертируем в base64
        if (newsPost.image && Buffer.isBuffer(newsPost.image)) {
            newsPost.image = `data:image/png;base64,${newsPost.image.toString('base64')}`;
        }

        res.json(newsPost);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Создание нового поста
exports.createNewsPost = async (req, res) => {
    try {
        // Конвертация изображения в чистый base64

        const base64Data = req.body.image;

        // Проверяем, есть ли изображение и не является ли оно null
        let buffer = null; // По умолчанию устанавливаем buffer в null
        if (base64Data) {
            buffer = Buffer.from(base64Data, 'base64'); // Конвертируем в Buffer только если image не null
        }

        const { rows } = await pool.query(createNewsPostQuery, [
            req.body.dateTimePublication,
            req.body.image = buffer,
            req.body.title,
            req.body.message,
            req.body.isArchived
        ]);

        res.status(201).json(rows[0]); // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Обновление новости
exports.updateNewsPost = async (req, res) => {
    try {
        // Конвертация изображения в чистый base64

        const base64Data = req.body.image;

        // Проверяем, есть ли изображение и не является ли оно null
        let buffer = null; // По умолчанию устанавливаем buffer в null
        if (base64Data) {
            buffer = Buffer.from(base64Data, 'base64'); // Конвертируем в Buffer только если image не null
        }

        const { rows } = await pool.query(updateNewsPostQuery, [
            req.body.dateTimePublication,
            req.body.image = buffer,
            req.body.title,
            req.body.message,
            req.body.isArchived,
            req.params.id
        ]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Пост не найден' });
        }

        res.json(rows[0]);  // Успешно
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Удаление новости
exports.deleteNewsPosts = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) { // Проверка на существование данных, на массив, на длину массива
            return res.status(400).json({ error: 'Некорректный список ID' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        const { rows } = await pool.query(deleteNewsPostsQuery, [numericIds]); // Передаем список id для удаления
        res.json({ message: 'Посты успешно удалены', deleted: rows });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

//  Архивировать или разархивировать список
exports.archiveNewsPosts = async (req, res) => {
    try {
        const { ids, archive } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0 || typeof archive !== 'boolean') { // Проверка на существование данных, на массив, на длину массива, на тип данных
            return res.status(400).json({ error: 'Некорректные параметры' });
        }

        // Преобразуем ID в числа
        const numericIds = ids.map(id => parseInt(id));

        const { rows } = await pool.query(archiveNewsPostsQuery, [numericIds, archive]);
        res.json({
            message: archive ? 'Новостные посты архивированы' : 'Новостные посты извлечены из архива',
            updated: rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
};