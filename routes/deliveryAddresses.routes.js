// Маршруты для работы с адресами доставки

const express = require('express');
const router = express.Router();
const deliveryAddressesController = require('../controllers/deliveryAddresses.controller'); // Контроллер для работы с адресами доставки
const authMiddleware = require('../middleware/auth.middleware'); // Проверка авторизации пользователя

router.get('/address/:id', authMiddleware, deliveryAddressesController.getDeliveryAddressById); // Получить адрес по id
router.get('/:id', authMiddleware, deliveryAddressesController.getDeliveryAddressesByIdClient); // Получить список адресов клиента
router.post('/', authMiddleware, deliveryAddressesController.createDeliveryAddress), // Создать адрес доставки клиента
router.put('/:id', authMiddleware, deliveryAddressesController.updateDeliveryAddress), // обновить адрес клиента
router.delete('/:id', authMiddleware, deliveryAddressesController.deleteDeliveryAddress) // Удалить адрес клиента

module.exports = router;