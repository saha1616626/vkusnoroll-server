// Основной файл node приложения

process.env.TZ = 'Europe/Moscow'; // Установка часового пояса

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
const orderStatusesRoutes = require('./routes/orderStatuses.routes.js');
const chatRoutes = require('./routes/chat.routes.js');
const deliveryWorkRoutes = require('./routes/deliveryWork.routes.js');
const deliverySettingsRoutes = require('./routes/deliverySettings.routes.js');
const deliveryAddressesRoutes = require('./routes/deliveryAddresses.routes.js');
const ordersRoutes = require('./routes/orders.routes.js');

const app = express();

const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

app.use(cookieParser()); // Middleware для обработки cookies

app.use((req, res, next) => { // Проверка токена аутентификации из cookie
    const tokens = { // Cоздается собственный middleware, который проверяет наличие токена в cookies
        'token': 'admin',
        'tokenUser': 'user',
        'tokenManager': 'manager'
    };

    Object.entries(tokens).forEach(([cookieName, userType]) => {
        const token = req.cookies[cookieName];
        if (token) {  // Если токен существует, код выполняет проверку его действительности
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = { ...decoded, userType }; // Если токен действителен, его расшифрованное содержимое (например, пользовательские данные) присваивается req.user, что позволяет этому значению быть доступным в следующих middleware и обработчиках маршрутов
            } catch (err) {
                res.clearCookie(cookieName); // Если токен недействителен (например, истек, был подделан и т. д.), возникает ошибка, и в этом случае cookie с токеном очищается 
            }
        }
    });

    next(); // Позволяет передать запрос клиенту, иначе при отсутствии вызова запрос зависнет и не дойдет до клиента
});

// Устанавливаем лимит HTTP-запроса
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Настройка CORS для разных клиентов
const allowedOrigins = [
    'http://localhost:3000', // Admin
    'http://localhost:3001', // Manager
    'http://localhost:3002', // Restaurant
    'http://localhost:3003'  // Дополнительный клиент
];

app.use(cors({
    origin: (origin, callback) => {
        // Разрешить запросы без origin (для Postman и др)
        if (!origin) {
            console.log('Запрос без origin (тестовый)');
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            console.log(`Разрешен запрос от: ${origin}`);
            callback(null, true);
        } else {
            console.log(`Заблокирован запрос от: ${origin}`);
            callback(new Error('Доступ запрещен политикой CORS'));
        }
    },
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true, // Разрешить передачу кук и заголовков авторизации
    optionsSuccessStatus: 200 // Для старых браузеров
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
app.use('/api/orderStatuses', orderStatusesRoutes); // Статусы заказов
app.use('/api/deliveryWork', deliveryWorkRoutes); // Рабочее время ресторана
app.use('/api/deliverySettings', deliverySettingsRoutes); // Настройка доставки ресторана
app.use('/api/deliveryAddresses', deliveryAddressesRoutes); // Адреса доставки
app.use('/api/orders', ordersRoutes); // Заказы
// app.use('/api/chat', chatRoutes); // Чаты

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

module.exports = app;

