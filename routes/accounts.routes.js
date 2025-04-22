// Маршруты для работы с учетными записями// Маршруты для работы с учетными записями

const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accounts.controller'); // Контроллер для работы с учетными записями
const authMiddleware = require('../middleware/auth.middleware'); // Проверка авторизации пользователя

// Общие маршруты
router.get('/user/:id', accountsController.getAccountById);

// Маршруты для клиента (пользовательская часть)
router.patch('/buyer/:id', authMiddleware, accountsController.updateAccountBuyer); // Обновление данных в личном кабинете
router.post('/buyer', accountsController.createAccountBuyer); // Регистрация аккаунта

// Маршруты для сотрудников (админ часть)
router.get('/employees', accountsController.getEmployees);
router.post('/employees', accountsController.createEmploye);
router.delete('/employees', accountsController.deleteEmploye);
router.post('/employees/:id/send-code', accountsController.sendEmployeeСonfirmationСodeEmail); // Отправка кода подтверждения на Email
router.post('/employees/:id/verify-code', accountsController.verifyEmployeeСonfirmationСodeEmail); // Проверка кода подтверждения

// Маршруты для пользователей (админ часть)
router.get('/clients', accountsController.getClients);

// TODO добавить запросы в отдельный файл (новые и старые из контроллера)

module.exports = router;