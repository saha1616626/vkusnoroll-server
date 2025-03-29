// Настройка БД
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'foodDelivery',
  password: 'd1S4h!kmS',
  port: 5432
});

module.exports = pool;