// Маршруты для настройки рабочего времени ресторана

const express = require('express');
const router = express.Router();
const deliveryWorkController = require('../controllers/deliveryWork.controller'); // Контроллер

router.get('/current', deliveryWorkController.getCurrentDeliveryTime); // Получение актуального времени доставки

// Работа со значениями времени по умолчанию
router.get('/default-time', deliveryWorkController.getDefaultWorkingTime);
router.post('/default-time', deliveryWorkController.updateDefaultWorkingTime);

router.get('/', deliveryWorkController.getListRestaurantWorkingTime);
router.get('/:id', deliveryWorkController.getDeliveryTimeByDate);
router.post('/', deliveryWorkController.createRestaurantWorkingTime);
router.put('/:id', deliveryWorkController.updateRestaurantWorkingTime);
router.delete('/', deliveryWorkController.deleteRestaurantWorkingTime);

module.exports = router;