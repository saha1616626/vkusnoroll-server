// Точка входа

const app = require('./app');
const { initWebSocket } = require('./websocket');
const PORT = process.env.PORT || 5000; // Настройка порта сервера

// Сообщаем на каком порту работает сервер
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Инициализация WebSocket 
initWebSocket(server);