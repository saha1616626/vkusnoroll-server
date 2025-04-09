// Маршруты для входа, выхода из учетной записи и тд

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller'); // Контроллер для входа/выхода т тд

router.post('/login', authController.loginAdmin);
router.post('/logout', authController.logout);

module.exports = router;