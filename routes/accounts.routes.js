// Маршруты для работы с учетными записями

const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accounts.controller'); // Контроллер для работы с учетными записями
const authMiddleware = require('../middleware/auth.middleware'); // Проверка авторизации пользователя

// Общие маршруты
router.get('/user/:id', accountsController.getAccountById);
router.put('/user/:id', accountsController.updateEmail);

// Маршруты для клиента (пользовательская часть)
router.patch('/buyer/:id', authMiddleware, accountsController.updateAccountBuyer); // Обновление данных в личном кабинете
router.post('/buyer', accountsController.createAccountBuyer); // Регистрация аккаунта
router.post('/buyer/:id/send-code', accountsController.sendBuyerСonfirmationСodeEmail); // Отправка кода подтверждения на Email
router.post('/buyer/:id/verify-code', accountsController.verifyBuyerСonfirmationСodeEmail); // Проверка кода подтверждения

// Маршруты для сотрудников (админ часть)
router.get('/employees', accountsController.getEmployees);
router.post('/employees', accountsController.createEmploye);
router.post('/employees/:id/send-code', accountsController.sendEmployeeСonfirmationСodeEmail); // Отправка кода подтверждения на Email
router.post('/employees/:id/verify-code', accountsController.verifyEmployeeСonfirmationСodeEmail); // Проверка кода подтверждения
router.get('/employees/:id/active-chats', accountsController.checkActiveChats); // Количество незавершенных чатов у выбранного пользователя
router.delete('/employees/:id', accountsController.deleteEmploye); // Удаление сотрудника
router.put('/employees/:id', accountsController.updateEmploye);


// Маршруты для пользователей (админ часть)
router.get('/clients/filters', accountsController.getClientsPaginationFilters); // Получение списка пользователей с пагинацией и фильтрами
router.get('/clients', accountsController.getClients);
router.put('/clients/:id', accountsController.updateClient);
router.delete('/clients/:id', accountsController.deleteClient);

// TODO добавить запросы в отдельный файл (новые и старые из контроллера)

module.exports = router;