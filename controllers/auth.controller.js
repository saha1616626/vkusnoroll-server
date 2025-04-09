// Контроллер для входа/выхода т тд

const bcrypt = require('bcrypt');
const pool = require('../config/db'); // Подключение к БД
const jwt = require('jsonwebtoken');
const {
    getUserBasedProvidedData
} = require('../services/auth.query.service');

// Вход администратора
exports.loginAdmin = async (req, res) => {
    try {
        const { login, password } = req.body;

        // Валидация входных данных
        if (!login || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        // Получаем пользователя с хэшем пароля
        const { rows } = await pool.query(getUserBasedProvidedData, [login]);

        const user = rows[0]; // первая строка

        // Проверка пароля
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        // Проверка роли
        if (user.role !== 'Администратор') {
            return res.status(403).json({ error: 'Доступ запрещен' });
        }

        // Генерация токена. JWT_SECRET - секретный ключ для подписи токена
        const token = jwt.sign(
            { userId: user.id, role: user.role }, // Полезная нагрузка токена (payload)
            process.env.JWT_SECRET, // Секретный ключ для подписи токена
            { expiresIn: '1h' } // Время жизни токена (1 час)
        ); // Время жизи токена 1 час

        // Установка токена в cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        res.json({
            message: 'Успешный вход',
            role: user.role
        }); // Возврат токена и роли
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};

// Выход
exports.logout = async (req, res) => {
    try {
        // Очистка cookie
        res.clearCookie('token');
        res.json({ message: 'Успешный выход' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
};
