// Автоматическое выполнение задач на сервере

const cron = require('node-cron');
const accountClientCleanup = require('./jobs/accountClientCleanup.job');

const initCronJobs = () => {
  // Ежедневно в 00:00
  cron.schedule('0 0 * * *', accountClientCleanup, { // Задача для автоматического удаления неподтвержденных учетных записей клиентов, которые созданы созданы более суток назад
    scheduled: true,
    timezone: 'Europe/Moscow'
  });

  console.log('Cron jobs initialized');
};

module.exports = initCronJobs;