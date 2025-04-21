const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { mailopost } = require('./mail.config');
const confirmationTemplate = fs.readFileSync(path.join(__dirname, 'templates/confirmationRegistration.html'), 'utf8');

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
            const html = confirmationTemplate
                .replace(/\${code}/g, code)
                .replace(/\${year}/g, new Date().getFullYear());

            const response = await this.transport.post('/email/messages', {
                from_email: mailopost.senderEmail,
                from_name: mailopost.senderName,
                to: email,
                subject: 'Подтверждение email в vkusnoroll.ru',
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
}

module.exports = new MailService();