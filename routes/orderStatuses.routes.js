// Маршруты для статусов заказов

const express = require('express');
const router = express.Router();
const orderStatusController = require('../controllers/orderStatuses.controller'); // Контроллер для статусов

router.get('/', orderStatusController.getStatuses);
router.get('/:id', orderStatusController.getStatusById);
router.post('/', orderStatusController.createStatus);
// Сначала /sequence, а потом /:id, иначе Express обработает /sequence (где id = 'sequence')
router.put('/sequence', orderStatusController.updateSequence); // Обновление последовательности статусов
router.put('/:id', orderStatusController.updateStatus);
router.delete('/:id', orderStatusController.deleteStatus);

module.exports = router;