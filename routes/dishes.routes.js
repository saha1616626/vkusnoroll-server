// Маршруты для блюд

const express = require('express');
const router = express.Router();
const dishesController = require('../controllers/dishes.controller'); // Контроллер для блюд

router.get('/', dishesController.getAllDishes);

module.exports = router;