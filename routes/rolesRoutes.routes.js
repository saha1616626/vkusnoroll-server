// Маршруты для работы с ролями

const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/roles.controller'); // Контроллер для работы с ролями

router.get('/', rolesController.getRoles);

module.exports = router;