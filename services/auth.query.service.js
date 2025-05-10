// Сервис запросов. вход, выход и тд.

// Получение пользователя по предоставленным данным для авторизации
exports.getUserBasedProvidedData = `
    SELECT u.*, r.name as role 
    FROM account u
    JOIN role r ON u."roleId" = r.id`;

// Получение данных администратора
exports.getAdminBasedProvidedData = `
    ${exports.getUserBasedProvidedData}
    WHERE login = $1`;

// Получение данных менеджера
exports.getManagerBasedProvidedData = `
    ${exports.getUserBasedProvidedData}
    WHERE login = $1`;

// Получение данных пользователя
exports.getClientBasedProvidedData = `
    ${exports.getUserBasedProvidedData}
    WHERE email = $1`;