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
    a."isAccountTermination"
  FROM account a
  JOIN role r ON a."roleId" = r.id
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
    "isAccountTermination")
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9)
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
  "isAccountTermination")
VALUES ($1, $2, $3, NOW(), false)
RETURNING *
`;

// Проверка уникальности Email для данной роли
exports.checkEmailForUniqueGivenRoleQuery = `
  SELECT EXISTS(
    SELECT 1 
    FROM account 
    WHERE email = $1 
      AND "roleId" = $2
  ) AS "emailExists";
`;