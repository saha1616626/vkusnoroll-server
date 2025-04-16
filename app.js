// Основной файл node приложения

const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Используется для загрузки переменных окружения из файла .env. Чтобы использовать переменные без необходимости явно задавать в коде

const dishesRoutes = require('./routes/dishes.routes');
const categoriesRoutes = require('./routes/categories.routes');
const newsPostsRoutes = require('./routes/newsPosts.routes');
const authRoutes = require('./routes/auth.routes');
const accountsRoutes = require('./routes/accounts.routes.js');
const rolesRoutes = require('./routes/rolesRoutes.routes.js');
const cartRoutes = require('./routes/cart.routes');

const app = express();

const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

app.use(cookieParser()); // Middleware для обработки cookies
app.use((req, res, next) => { // Проверка токена аутентификации в cookie
    const token = req.cookies.token; // Cоздается собственный middleware, который проверяет наличие токена в cookies

    if (token) { // Если токен существует, код выполняет проверку его действительности
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded; // Если токен действителен, его расшифрованное содержимое (например, пользовательские данные) присваивается req.user, что позволяет этому значению быть доступным в следующих middleware и обработчиках маршрутов
        } catch (err) {
            res.clearCookie('token'); // Если токен недействителен (например, истек, был подделан и т. д.), возникает ошибка, и в этом случае cookie с токеном очищается 
        }
    }

    next(); // Позволяет передать запрос клиенту, иначе при отсутствии вызова запрос зависнет и не дойдет до клиента
});

// Устанавливаем лимит HTTP-запроса
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Настройка CORS для разных клиентов
const allowedOrigins = [
    'http://localhost:3000', // Admin
    'http://localhost:3001', // Manager
    'http://localhost:3002',  // Restaurant
    'http://localhost:3003'
];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Маршруты
app.use('/api/dishes', dishesRoutes); // Блюда
app.use('/api/categories', categoriesRoutes); // Категории
app.use('/api/newsPosts', newsPostsRoutes); // Посты
app.use('/api/auth', authRoutes); // Авторизация
app.use('/api/roles', rolesRoutes); // Роли
app.use('/api/accounts', accountsRoutes); // Учетные записи
app.use('/api/cart', cartRoutes); // Корзина

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;

