// Websocket
const WebSocket = require('ws');
const jwt = require('jsonwebtoken'); // Работа с токеном
let wss;

// Хранилище для связи пользователей с соединениями
const activeConnections = new Map();

const initWebSocket = (server) => {
    wss = new WebSocket.Server({
        server,
        path: '/ws',
        // Оповещение только авторизованного пользователя
        verifyClient: (info, done) => {
            const token = new URL(info.req.url, 'http://localhost').searchParams.get('token');

            // Проверка токена
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return done(false, 401, 'Unauthorized');
                }

                // Сохраняем данные пользователя в запросе
                info.req.user = decoded;
                done(true);
            });
        }
    });

    // Обработчик подключений
    wss.on('connection', (ws, req) => {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Сохраняем соединение с информацией о пользователе
        activeConnections.set(userId, {
            ws,
            role: userRole
        });

        // Удаляем при закрытии
        ws.on('close', () => {
            activeConnections.delete(userId);
        });
    });

    return wss;
};

// Рассылка уведомлений менеджерам
const broadcastNewOrder = (orderNumber) => {
    activeConnections.forEach((connection, userId) => {
        if (
            connection.ws.readyState === WebSocket.OPEN &&
            connection.role === 'Менеджер'
        ) {
            connection.ws.send(JSON.stringify({
                type: 'NEW_ORDER',
                orderNumber
            }));
        }
    });
};

module.exports = {
    initWebSocket,
    broadcastNewOrder
};