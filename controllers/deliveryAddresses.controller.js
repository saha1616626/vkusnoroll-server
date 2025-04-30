// Контроллер для работы с адресами доставки

const pool = require('../config/db'); // Подключение к БД
const {
    getDeliveryAddressesQuery,
    getDeliveryAddressesByIdClientQuery
} = require('../services/deliveryAddress.query.service'); // Запросы

// Получить список адресов клиента
exports.getDeliveryAddressesByIdClient = async (req, res) => {
    try {
        const { rows } = await pool.query(
            getDeliveryAddressesByIdClientQuery,
            [req.params.id]);
        
        if(rows.length === 0) {
            return res.status(404).json({ error: 'Адреса доставки не найдены' });
        }

        res.json(rows); // Успешно
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки адресов доставки' });
    }
}