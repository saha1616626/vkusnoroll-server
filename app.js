// Основной файл node приложения

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Используется для загрузки переменных окружения из файла .env. Чтобы использовать переменные без необходимости явно задавать в коде

const dishesRoutes = require('./routes/dishes.routes');
const categoriesRoutes = require('./routes/categories.routes');
const newsPostsRoutes = require('./routes/newsPosts.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

app.use(cookieParser());
app.use((req, res, next) => {
    const token = req.cookies.token;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        } catch (err) {
            res.clearCookie('token');
        }
    }

    next();
});

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
app.use('/api/newsPosts', newsPostsRoutes);
app.use('/api/auth', authRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;

