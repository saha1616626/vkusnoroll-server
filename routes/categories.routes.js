// Маршруты для категорий

const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categories.controller'); // Контроллер для категорий

router.get('/', categoriesController.getAllCategories);
router.get('/:id', categoriesController.getСategoryById);
router.post('/', categoriesController.createСategory);
router.put('/:id', categoriesController.updateСategory);
router.delete('/', categoriesController.deleteCategories);
router.put('/', categoriesController.archiveCategories);

module.exports = router;