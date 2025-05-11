// Websocket
const WebSocket = require('ws');
const jwt = require('jsonwebtoken'); // Работа с токеном
const { getAccountByIdForWebSocket } = require('./controllers/accounts.controller'); // Сервис для работы с учетными записями
let wss;

// Хранилище для связи пользователей с соединениями
const activeConnections = new Map();

const initWebSocket = (server) => {
    wss = new WebSocket.Server({
        server,
        path: '/ws',
        // Оповещение только авторизованного пользователя
        verifyClient: async (info, done) => {
            const token = new URL(info.req.url, 'http://localhost').searchParams.get('token');

            // Проверка токена
            jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
                if (err) {
                    return done(false, 401, 'Unauthorized');
                }

                try {
                    // Запрос актуальных данных из БД через сервис. Данные о пользователе обновляются при обновлении страницы
                    const user = await getAccountByIdForWebSocket(decoded.userId);
                    if (!user) return done(false, 404, 'User not found');

                    info.req.user = { ...decoded, ...user };
                    done(true);
                } catch (error) {
                    console.error('WebSocket auth error:', error);
                    done(false, 500, 'Internal Server Error');
                }
            });
        }
    });

    // Обработчик подключений
    wss.on('connection', (ws, req) => {
        const userId = req.user.id;
        const userRole = req.user.role;
        const isOrderManagementAvailable = req.user?.isOrderManagementAvailable || false;
        const isMessageCenterAvailable = req.user?.isMessageCenterAvailable || false;
        const isAccountTermination = req.user?.isAccountTermination || false;

        // Сохраняем соединение с информацией о пользователе
        activeConnections.set(userId, {
            ws,
            role: userRole,
            isOrderManagementAvailable: isOrderManagementAvailable,
            isMessageCenterAvailable: isMessageCenterAvailable,
            isAccountTermination: isAccountTermination
        });

        // Удаляем при закрытии
        ws.on('close', () => {
            activeConnections.delete(userId);
        });
    });

    return wss;
};

// Рассылка уведомлений менеджерам
const broadcastNewOrder = (orderId, orderNumber, orderPlacementTime) => {
    activeConnections.forEach((connection, userId) => {
        if (
            connection.ws.readyState === WebSocket.OPEN && // Проверка соединения
            connection.role === 'Менеджер' && // Проврека роли
            connection.isOrderManagementAvailable && // Проверяем дотсуп к разделу с заказами
            !connection.isAccountTermination // Проверяем блокировку аккаунта
        ) {
            connection.ws.send(JSON.stringify({
                type: 'NEW_ORDER',
                orderId,
                orderNumber,
                orderPlacementTime
            }));
        }
    });
};

module.exports = {
    initWebSocket,
    broadcastNewOrder
};