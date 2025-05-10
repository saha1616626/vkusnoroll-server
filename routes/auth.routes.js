// Маршруты для входа, выхода из учетной записи и тд

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller'); // Контроллер для входа/выхода т тд

// Администратор
router.post('/admin/login', authController.loginAdmin);
router.post('/admin/logout', authController.logoutAdmin);

// Менеджер
router.post('/manager/login', authController.loginManager);
router.post('/manager/logout', authController.logoutManager);

// Пользователь
router.post('/user/login', authController.loginUser);
router.post('/user/logout', authController.logoutUser);

module.exports = router;