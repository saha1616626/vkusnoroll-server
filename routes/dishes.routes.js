// Маршруты для блюд

const express = require('express');
const router = express.Router();
const dishesController = require('../controllers/dishes.controller'); // Контроллер для блюд

router.get('/available-no-image', dishesController.getUnarchivedDishesNoImageWithActiveCategory); // Получение списка блюд без изображения и те товары, которые не в архиве, и их категория не в архиве

router.get('/', dishesController.getAllDishes);
router.get('/:id', dishesController.getDishById);
router.post('/', dishesController.createDish);
router.put('/:id', dishesController.updateDish);
router.delete('/', dishesController.deleteDishes);
router.put('/', dishesController.archiveDishes);

module.exports = router;