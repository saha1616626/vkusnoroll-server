// Точка входа

const app = require('./app');
const PORT = process.env.PORT || 5000; // Настройка порта сервера

// Сообщаем на каком порту работает сервер
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});