// Маршруты для работы с заказами

const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller'); // Контроллер для работы с заказами
const authMiddleware = require('../middleware/auth.middleware'); // Проверка авторизации пользователя

router.get('/reports/generation/:type', (req, res) => {
    if (req.params.type === 'orders') {
        return ordersController.generateOrdersReport(req, res); // Генерация отчета по заказам
    } else {
        return ordersController.generateDishSalesReport(req, res); // Генерация отчета  по товарам
    }
});
router.get('/report/dish', ordersController.getDishSalesReport), // Получить отчёт по продажам блюд с пагинацией, группировкой и фильтрами
router.get('/report/order', ordersController.getOrdersReport), // Получить отчёт по заказам с пагинацией и статистикой

router.put('/manager/change-payment-statuses', ordersController.changeOrderPaymentStatuses), // Изменить статус оплаты заказов
router.put('/manager/change-status', ordersController.changeOrderStatuses), // Изменить статус заказов
router.get('/manager/all', authMiddleware, ordersController.getAllOrders); // Получить все заказы
router.get('/manager/:id', ordersController.getOrderById); // Получить заказ по id
router.put('/manager/:id', ordersController.updateOrder), // Обновить заказ
router.post('/manager', ordersController.createOrder) // Создать заказ для клиента
router.delete('/manager', ordersController.deleteOrders) // Удалить заказ(ы)

router.get('/client/:id', authMiddleware, ordersController.getOrdersByIdClient); // Получить список заказов клиента
router.post('/client', ordersController.createOrderClient) // Оформление заказа клиентом 

module.exports = router;