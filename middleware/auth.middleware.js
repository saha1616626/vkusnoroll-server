// Middleware для проверки авторизации пользователя

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Извлекаем заголовок авторизации из входящего запроса
    const authHeader = req.headers.authorization;

    // Проверяем, что заголовок существует и начинается с 'Bearer '
    if (!authHeader?.startsWith('Bearer ')) {
        // Если нет, возвращаем статус 401 Unauthorized с сообщением
        return res.status(401).json({ message: 'Authorization header missing' });
    }

    // Извлекаем токен из заголовка, разделяя строку по пробелу и беря вторую часть
    const token = authHeader.split(' ')[1];

    try {
        // Пытаемся проверить и декодировать токен с помощью секрета из окружения
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

         // Если токен действителен, сохраняем информацию о пользователе в объекте запроса
        req.user = {
            id: decoded.userId
        };

        // Передаем управление следующему middleware или обработчику маршрута
        next();
    } catch (error) {
        // Если токен недействителен, возврат статуса 401 с сообщением об ошибке
        return res.status(401).json({ message: 'Invalid token' });
    }
};