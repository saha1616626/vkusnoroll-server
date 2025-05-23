// Сервис запросов. Учетные записи

// Получаем список всех учетных записей, где roleId заменен на название роли
exports.getAccountsQuery = `
SELECT
    a.id,
    a."roleId",
    r.name as role,
    a.name,
    a.surname,
    a.patronymic,
    a.email,
    a."numberPhone",
    a.login,
    a."password",
    a."registrationDate",
    a."confirmationСode",
    a."dateTimeСodeCreation",
    a."isAccountTermination",
    a."isEmailConfirmed",
    a."isOrderManagementAvailable", 
    a."isMessageCenterAvailable"
  FROM account a
  JOIN role r ON a."roleId" = r.id
`;

// Обновление email учетной записи
exports.updateEmailQuery = `
  UPDATE account 
  SET 
    email = $1
  WHERE id = $2
  RETURNING *;
`;

// Получаем учетную запись по id
exports.getAccountByIdQuery = `
  ${exports.getAccountsQuery}
  WHERE a.id = $1
`;

// Получаем список всех учетных записей сотрудников
exports.getEmployeesQuery = `
    ${exports.getAccountsQuery}
    WHERE r.name != 'Пользователь'
`;

// Создание учетной записи сотрудника 
exports.createEmployeQuery = `
  INSERT INTO account (
    "roleId",
    name,
    surname,
    patronymic,
    email,
    "numberPhone",
    login,
    password,
    "registrationDate",
    "isAccountTermination",
    "isOrderManagementAvailable", 
    "isMessageCenterAvailable")
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11)
  RETURNING *
`;

// Обновление сотрудника
exports.updateEmployeQuery = `
UPDATE account SET
  "roleId" = $1,
  name = $2,
  surname = $3,
  patronymic = $4,
  email = $5,
  "numberPhone" = $6,
  login = $7,
  "isAccountTermination" = $8,
  "isOrderManagementAvailable" = $9, 
  "isMessageCenterAvailable" = $10
  WHERE id = $11
  RETURNING *
`;

// Получаем список всех учетных записей пользователей
exports.getClientsQuery = `
    ${exports.getAccountsQuery}
    WHERE r.name != 'Администратор' and r.name != 'Менеджер'
`;

// Обновление данных учетной записи клиентом (пользовательская часть)
exports.updateAccountBuyerQuery = `
  UPDATE account 
  SET 
    name = $1,
    "numberPhone" = $2
  WHERE id = $3
  RETURNING *;
`;

// Создание (регистрация) учетной записи клиента (пользовательская часть)
exports.createAccountBuyerQuery = `
  INSERT INTO account (
    "roleId",
    email,
    password,
    "registrationDate",
    "isAccountTermination",
    "isEmailConfirmed",
    "isOrderManagementAvailable", 
    "isMessageCenterAvailable"
  )
  VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7)
  RETURNING *
`;

// Поверка уникальности Email во всей системе
exports.checkEmailForUniqueGivenRoleQuery = `
  SELECT EXISTS(
    SELECT 1 
    FROM account 
    WHERE email = $1
  ) AS "emailExists";
`;

// Проверка уникальности логина
exports.checkLoginForUniqueQuery = `
  SELECT EXISTS(
    SELECT 1 
    FROM account 
    WHERE login = $1
  ) AS "loginExists";
`;

// Установка кода подтверждения email в БД
exports.installingEmailConfirmationCodeQuery = `
UPDATE account 
SET "confirmationСode" = $1, 
    "dateTimeСodeCreation" = NOW() 
WHERE id = $2 
RETURNING email, "dateTimeСodeCreation"
`;

// Проверка код подтверждения отправленного на email
exports.verificationConfirmationCodeQuery = `
UPDATE account 
SET "isEmailConfirmed" = true,
    "confirmationСode" = NULL,
    "dateTimeСodeCreation" = NULL 
WHERE id = $1 
  AND "confirmationСode" = $2 
  AND "dateTimeСodeCreation" > NOW() - INTERVAL '24 hours'
RETURNING *
`;

// Количество незавершенных чатов у выбранного пользователя
exports.checkUserActiveChatsQuery = `
SELECT COUNT(*) as "activeChats" 
  FROM chat 
  WHERE "accountId" = $1 AND "isChatOver" = false
`;

// Обновление чатов после удаления аккаунта. Незавершённым чатам устанавливается статус «непринятый»
exports.updatingChatsAfterAccountDeletion = `
UPDATE chat 
  SET "isChatAccepted" = false 
  WHERE "accountId" = $1 AND "isChatOver" = false
`;

// Обновление клиентского аккаунта (админ часть)
exports.updateClientQuery = `
  UPDATE account 
  SET 
    "isAccountTermination" = $1
  WHERE id = $2
  RETURNING *;
`;
