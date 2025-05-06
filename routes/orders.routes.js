// Маршруты для работы с заказами

const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller'); // Контроллер для работы с заказами
const authMiddleware = require('../middleware/auth.middleware'); // Проверка авторизации пользователя

router.get('/manager/:id', ordersController.getOrderById); // Получить заказ по id
router.put('/manager/:id', ordersController.updateOrder), // Обновить заказ
router.post('/manager', ordersController.createOrder) // Создать заказ для клиента
router.delete('/manager/:id', ordersController.deleteOrders) // Удалить заказ(ы)

router.get('/client/:id', authMiddleware, ordersController.getOrdersByIdClient); // Получить список заказов клиента
router.post('/client', ordersController.createOrderClient) // Оформление заказа клиентом 

module.exports = router;