// Сервис запросов. вход, выход и тд.

// Получение пользователя по предоставленным данным для авторизации
exports.getUserBasedProvidedData = `
    SELECT u.*, r.name as role 
    FROM account u
    JOIN role r ON u."roleId" = r.id
    WHERE login = $1`;

    