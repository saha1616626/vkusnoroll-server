// Задача для автоматического удаления неподтвержденных учетных записей клиентов, которые созданы созданы более суток назад

const pool = require('./../../config/db'); // Подключение к БД

module.exports = async () => {
    try {
        const result = await pool.query(`
            DELETE FROM account a
            USING role r
            WHERE 
                a."roleId" = r.id
                AND r.name = 'Пользователь'
                AND a."isEmailConfirmed" = false 
                AND a."registrationDate" < NOW() - INTERVAL '24 HOURS'
            `);
        console.log(`Account cleanup: Removed ${result.rowCount} unconfirmed accounts`);
    } catch (error) {
        console.error('Account cleanup error:', error);
    }
};