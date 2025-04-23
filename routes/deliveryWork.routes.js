// Маршруты для настройки рабочего времени ресторана

const express = require('express');
const router = express.Router();
const deliveryWorkController = require('../controllers/deliveryWork.controller'); // Контроллер

router.get('/', deliveryWorkController.getListRestaurantWorkingTime);