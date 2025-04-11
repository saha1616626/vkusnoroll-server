// Маршруты для работы с учетными записями

const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accounts.controller'); // Контроллер для работы с учетными записями

router.get('/user/:id', accountsController.getAccountById);
router.get('/employees', accountsController.getEmployees);
router.get('/clients', accountsController.getClients);

module.exports = router;