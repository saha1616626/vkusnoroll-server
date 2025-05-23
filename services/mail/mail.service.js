const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { mailopost } = require('./mail.config');
// Шаблоны
const confirmationRegistrationTemplate = fs.readFileSync(path.join(__dirname, 'templates/confirmationRegistration.html'), 'utf8'); // Шаблон письма подтверждения Email после регистрации
const shiftConfirmationTemplate = fs.readFileSync(path.join(__dirname, 'templates/shiftConfirmation.html'), 'utf8'); // Шаблон письма подтверждения Email после смены или установки администратором
const passwordBuyerRecoveryTemplate = fs.readFileSync(path.join(__dirname, 'templates/passwordBuyerRecovery.html'), 'utf8'); // Шаблон письма для восстановления пароля покупателя

class MailService {
    constructor() {
        this.transport = axios.create({
            baseURL: mailopost.baseURL,
            headers: {
                'Authorization': `Bearer ${mailopost.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
    }

    // Подтверждение Email после регистрации
    async sendConfirmationRegistration(email, code) {
        try {
            const html = confirmationRegistrationTemplate
                .replace(/\${code}/g, code)
                .replace(/\${year}/g, new Date().getFullYear());

            const response = await this.transport.post('/email/messages', {
                from_email: mailopost.senderEmail,
                from_name: mailopost.senderName,
                to: email,
                subject: 'Подтверждение email на vkusnoroll.ru',
                html,
                text: `Ваш код подтверждения: ${code}\nКод действителен 24 часа\n\nС уважением, ВкусноРолл`,
                track_opens: true,
                track_clicks: false
            });

            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    // Подтверждение Email после смены или установки нового администратором 
    async sendShiftConfirmation(email, code) {
        try {
            const html = shiftConfirmationTemplate
                .replace(/\${code}/g, code)
                .replace(/\${year}/g, new Date().getFullYear());

            const response = await this.transport.post('/email/messages', {
                from_email: mailopost.senderEmail,
                from_name: mailopost.senderName,
                to: email,
                subject: 'Подтверждение email на vkusnoroll.ru',
                html,
                text: `Ваш код подтверждения: ${code}\nКод действителен 24 часа\n\nС уважением, ВкусноРолл.Админ`,
                track_opens: true,
                track_clicks: false
            });

            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    // Отправить код покупателю для восстановления пароля
    async sendCodeBuyerRecoveryPassword(email, code) {
        try {
            const html = passwordBuyerRecoveryTemplate
                .replace(/\${code}/g, code)
                .replace(/\${year}/g, new Date().getFullYear());

            const response = await this.transport.post('/email/messages', {
                from_email: mailopost.senderEmail,
                from_name: mailopost.senderName,
                to: email,
                subject: 'Восстановление пароля на vkusnoroll.ru',
                html,
                text: `Ваш код подтверждения: ${code}\nКод действителен 1 час\n\nС уважением, ВкусноРолл`,
                track_opens: true,
                track_clicks: false
            });

            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }
}

module.exports = new MailService();