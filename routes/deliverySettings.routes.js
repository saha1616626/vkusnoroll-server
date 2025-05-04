// Маршруты для настройки доставки ресторана

const express = require('express');
const router = express.Router();
const deliverySettingsController = require('../controllers/deliverySettings.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', deliverySettingsController.getSettings); // Получить все настройки доставки
// Предоставляем доступ к сохранению только авторизованному пользователю
router.post('/', authMiddleware, deliverySettingsController.saveSettings); // Обновить все настройки доставки

router.get('/delivery-zones', deliverySettingsController.getDeliveryZones); // Получить все зоны доставки
router.get('/order-settings', deliverySettingsController.getOrderSettings); // Получаем все необходимые данные для формирования заказа

module.exports = router;