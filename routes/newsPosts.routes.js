// Маршруты для новостей

const express = require('express');
const router = express.Router();
const newsPostsController = require('../controllers/newsPosts.controller'); // Контроллер для блюд

router.get('/', newsPostsController.getAllNewsPosts);
router.get('/:id', newsPostsController.getNewsPostById);
router.post('/', newsPostsController.createNewsPost);
router.put('/:id', newsPostsController.updateNewsPost);
router.delete('/', newsPostsController.deleteNewsPosts);
router.put('/', newsPostsController.archiveNewsPosts);

module.exports = router;