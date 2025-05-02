// Контроллер для работы с адресами доставки

const pool = require('../config/db'); // Подключение к БД
const {
    getDeliveryAddressesQuery,
    getDeliveryAddressByIdQuery,
    getDeliveryAddressesByIdClientQuery,
    checkingCountUserAddressesQuery,
    createDeliveryAddressQuery,
    updateDeliveryAddressQuery,
    deleteDeliveryAddressQuery
} = require('../services/deliveryAddress.query.service'); // Запросы

// Получить список адресов клиента
exports.getDeliveryAddressesByIdClient = async (req, res) => {
    try {
        const { rows } = await pool.query(
            getDeliveryAddressesByIdClientQuery,
            [req.params.id]);

        res.json(rows); // Успешно
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки адресов доставки' });
    }
}

// Получить адрес по id
exports.getDeliveryAddressById = async (req, res) => {
    try {
        const { rows } = await pool.query(
            getDeliveryAddressByIdQuery,
            [req.params.id]);

        res.json(rows); // Успешно
    } catch(err) {
        res.status(500).json({ error: 'Ошибка загрузки адреса доставки' });
    }
}

// Создать адрес доставки клиента
exports.createDeliveryAddress = async (req, res) => {
    try {
        const { accountId } = req.body;

        // Проверка адресов
        const checkResult = await pool.query(
            checkingCountUserAddressesQuery,
            [accountId]
        );

        // Получаем количество адресов
        const addressCount = parseInt(checkResult.rows[0].address_count, 10);

        // Проверка, что у пользователя не больше 10 адресов
        if (addressCount >= 10) {
            return res.status(400).json({
                error: 'Превышен лимит адресов. Удалите или измените существующий адрес'
            });
        }

        // Создание нового адреса
        const { rows } = await pool.query(createDeliveryAddressQuery, [
            req.body.accountId,
            req.body.city,
            req.body.street,
            req.body.house,
            req.body.apartment,
            req.body.entrance,
            req.body.floor,
            req.body.comment,
            req.body.isPrivateHome
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при создании адреса'
        });
    }
}

// Обновить адрес клиента
exports.updateDeliveryAddress = async (req, res) => {
    try {
        // Обновление адреса
        const { rows } = await pool.query(updateDeliveryAddressQuery, [
            req.body.city,
            req.body.street,
            req.body.house,
            req.body.apartment,
            req.body.entrance,
            req.body.floor,
            req.body.comment,
            req.body.isPrivateHome,
            req.params.id
        ]);

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Ошибка сервера при обновлении адреса'
        });
    }
}

// Удалить адрес клиента
exports.deleteDeliveryAddress = async (req, res) => {
    try {
        // Удаление
        await pool.query(
            deleteDeliveryAddressQuery,
            [req.params.id]
        );

        res.json({
            success: true,
            message: 'Адрес успешно удален'
        });
    } catch (err) {
        console.error('Ошибка удаления:', err);
        res.status(500).json({
            error: err.message || 'Ошибка при удалении адреса'
        });
    }
};
