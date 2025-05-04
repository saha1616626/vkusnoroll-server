// Контроллер для настройки доставки ресторана

const pool = require('../config/db');

// Получить все настройки доставки
exports.getSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Получаем все необходимые настройки
        const keys = [
            'delivery_zones',
            'delivery_default_price',
            'delivery_is_free',
            'delivery_free_threshold',
            'delivery_interval'
        ];

        const { rows } = await client.query(
            `SELECT key, value FROM "appSetting" WHERE key = ANY($1)`,
            [keys]
        );

        // Формируем результат с дефолтными значениями
        const settings = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        const result = {
            zones: settings.delivery_zones?.zones || [],
            defaultPrice: settings.delivery_default_price?.value || 300,
            isFreeDelivery: settings.delivery_is_free?.value || false,
            freeDeliveryThreshold: settings.delivery_free_threshold?.value || 0,
            deliveryInterval: settings.delivery_interval?.value || 30
        };

        await client.query('COMMIT');
        res.json(result);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка загрузки настроек' });
    } finally {
        client.release();
    }
};

// Обновить все настройки доставки
exports.saveSettings = async (req, res) => {
    const client = await pool.connect(); // Получаем клиент из пула
    try {
        await client.query('BEGIN');

        const {
            zones = [],
            defaultPrice = 300,
            isFreeDelivery = false,
            freeDeliveryThreshold = 0,
            deliveryInterval = 30
        } = req.body;

        // Удаляем старые настройки перед обновлением
        await client.query(
            `DELETE FROM "appSetting" WHERE key = ANY($1)`,
            [['delivery_zones', 'delivery_default_price', 'delivery_is_free',
                'delivery_free_threshold', 'delivery_interval']]
        );

        // Вставляем новые значения
        const queries = [
            {
                key: 'delivery_zones',
                value: {
                    zones: zones.map(zone => ({
                        name: zone.name,
                        coordinates: zone.coordinates,
                        price: zone.price || defaultPrice
                    }))
                }
            },
            { key: 'delivery_default_price', value: { value: defaultPrice } },
            { key: 'delivery_is_free', value: { value: isFreeDelivery } },
            {
                key: 'delivery_free_threshold',
                value: { value: isFreeDelivery ? freeDeliveryThreshold : null }
            },
            { key: 'delivery_interval', value: { value: deliveryInterval } }
        ];

        for (const query of queries) {
            await client.query(
                `INSERT INTO "appSetting" (key, value, "description") 
                 VALUES ($1, $2, 'Настройки доставки')
                 ON CONFLICT (key) DO UPDATE SET value = $2`,
                [query.key, query.value]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка сохранения настроек' });
    } finally {
        client.release();
    }
};

// Получить все зоны доставки
exports.getDeliveryZones = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Получаем необходимые настройки
        const keys = [
            'delivery_zones'
        ];

        const { rows } = await client.query(
            `SELECT key, value FROM "appSetting" WHERE key = ANY($1)`,
            [keys]
        );

        // Формируем результат с дефолтными значениями
        const settings = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        const result = {
            zones: settings.delivery_zones?.zones || []
        };

        await client.query('COMMIT');
        res.json(result);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка загрузки настроек' });
    } finally {
        client.release();
    }
}

// Получаем все необходимые данные для формирования заказа
exports.getOrderSettings = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Получаем настройки
        const keys = [
            'delivery_default_price',
            'delivery_is_free',
            'delivery_free_threshold',
            'delivery_interval'
        ];

        const settingsQuery = await client.query(
            `SELECT key, value FROM "appSetting" WHERE key = ANY($1)`,
            [keys]
        );

        // Получаем текущее время из БД
        const timeQuery = await client.query(`
            SELECT NOW() AT TIME ZONE 'Europe/Moscow' as server_time
        `);
        const serverTime = timeQuery.rows[0].server_time.toISOString();

        // Формируем ответ
        const settings = settingsQuery.rows.reduce((acc, row) => {
            acc[row.key] = row.value?.value;
            return acc;
        }, {});

        const result = {
            defaultPrice: settings.delivery_default_price || 300,
            isFreeDelivery: settings.delivery_is_free || false,
            freeThreshold: settings.delivery_free_threshold || 0,
            interval: settings.delivery_interval || 30,
            serverTime // Время из PostgreSQL
        };

        await client.query('COMMIT');
        res.json(result);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Ошибка загрузки настроек' });
    } finally {
        client.release();
    }
};