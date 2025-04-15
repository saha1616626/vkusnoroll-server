// Маршруты для работы с корзиной

const express = require('express');
const router = express.Router();

const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.use(authMiddleware); // Проверяет аутентификацию для всех маршрутов корзины
router.get('/', cartController.getCart);
router.post('/items', cartController.addItemCart);
router.put('/items/:dishId', cartController.updateItemCart);
router.delete('/items/:dishId', cartController.removeItemCart);

module.exports = router;