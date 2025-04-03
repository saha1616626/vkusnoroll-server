// Основной файл node приложения

const express = require('express');
const cors = require('cors');

const dishesRoutes = require('./routes/dishes.routes');
const categoriesRoutes = require('./routes/categories.routes');

const app = express();

// Устанавливаем лимит HTTP-запроса
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Настройка CORS для разных клиентов
const allowedOrigins = [
    'http://localhost:3000', // Admin
    'http://localhost:3001', // Manager
    'http://localhost:3002'  // Restaurant
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Маршруты
app.use('/api/dishes', dishesRoutes);
app.use('/api/categories', categoriesRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;

