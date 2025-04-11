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

// Получаем список всех учетных записей пользователей
exports.getClientsQuery = `
    ${exports.getAccountsQuery}
    WHERE r.name != 'Администратор' and r.name != 'Менеджер'
`;