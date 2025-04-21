//  Конфигурация почтового сервиса

require('dotenv').config();

module.exports = {
  mailopost: {
    apiKey: process.env.MAILOPOST_API_KEY,
    senderEmail: process.env.MAILOPOST_SENDER_EMAIL,
    senderName: process.env.MAILOPOST_SENDER_NAME,
    baseURL: 'https://api.mailopost.ru/v1'
  }
};