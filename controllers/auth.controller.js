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
            { expiresIn: '1m' } // Токен действителен всего 24 часа. После истечения этого времени токен больше не будет считаться действительным.
        );

        // Установка токена в cookie и отправка в теле ответа
        res.cookie('token', token, {
            httpOnly: true, // Флаг запрещает доступ к cookie с помощью JavaScript
            secure: process.env.NODE_ENV === 'production', // Флаг устанавливает cookie как "secure", что означает, что оно будет передаваться только по защищенному соединению HTTPS. Для продакшена.
            sameSite: 'strict', // Флаг предотвращает отправку cookie при кросс-доменных запросах
            maxAge: 60000 // Время жизни cookie на 24 часа, что совпадает с временем жизни JWT
        });

        res.json({
            message: 'Успешный вход',
            token, // Отправляем токен и в теле ответа
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
