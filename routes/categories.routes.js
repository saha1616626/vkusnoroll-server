// Маршруты для категорий

const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categories.controller'); // Контроллер для категорий

router.get('/', categoriesController.getAllCategories);

module.exports = router;