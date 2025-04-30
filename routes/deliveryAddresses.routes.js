// Маршруты для работы с адресами доставки

const express = require('express');
const router = express.Router();
const deliveryAddressesController = require('../controllers/deliveryAddresses.controller'); // Контроллер для работы с адресами доставки
const authMiddleware = require('../middleware/auth.middleware'); // Проверка авторизации пользователя

router.get('/:id', deliveryAddressesController.getDeliveryAddressesByIdClient); // Получить список адресов клиента

module.exports = router;