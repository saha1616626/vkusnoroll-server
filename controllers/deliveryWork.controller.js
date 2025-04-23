// Контроллер для настройки рабочего времени ресторана

const pool = require('../config/db');

// Получить список рабочего времени ресторана
exports.getListRestaurantWorkingTime = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM "deliveryWork" ORDER BY "date"');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};