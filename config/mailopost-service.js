// Подключение к почтовому серверу Mailopost

const axios = require('axios');
require('dotenv').config();

const mailopost = axios.create({
    baseURL: 'https://api.mailopost.ru/v1',
    headers: {
        'Authorization': `Bearer ${process.env.MAILOPOST_API_KEY}`,
        'Content-Type': 'application/json'
    }
});

// Подтверждение Email
const sendConfirmationEmail = async (email, code) => {
    try {
        const emailHtml = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Подтверждение email</title>
            <style>
                body { margin: 0; padding: 0; background-color: #f7fafc; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { padding: 24px; background: #2563eb; border-radius: 8px 8px 0 0; text-align: center; }
                .header h1 { font-size: 40px; font-weight: bold; color: #FFFFFF; }
                .content { padding: 32px 24px; color: #1a202c; }
                .code { font-size: 32px; letter-spacing: 4px; margin: 24px 0; padding: 16px; background: #ebf4ff; text-align: center; }
                .footer { padding: 24px; text-align: center; background: #f7fafc; border-radius: 0 0 8px 8px; font-size: 12px; color: #718096; }
                .logo { height: 40px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>ВкусноРолл</h1>
                </div>
                
                <div class="content">
                    <h1>Подтвердите вашу электронную почту</h1>
                    <p>Для завершения регистрации введите следующий код подтверждения:</p>
                    <div class="code">${code}</div>
                    <p>Код будет действителен в течение <strong>24 часов</strong>.</p>
                    <p>Если вы не запрашивали это письмо, просто проигнорируйте его.</p>
                </div>

                <div class="footer">
                    <p>© ${new Date().getFullYear()} ВкусноРолл</p>
                    <p>Это письмо отправлено автоматически, пожалуйста, не отвечайте на него</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const response = await mailopost.post('/email/messages', {
            from_email: process.env.MAILOPOST_SENDER_EMAIL,
            from_name: process.env.MAILOPOST_SENDER_NAME,
            to: email,
            subject: 'Подтверждение email в vkusnoroll.ru',
            html: emailHtml,
            text: `Ваш код подтверждения: ${code}\nКод действителен 24 часа\n\nС уважением, ВкусноРолл`,
            track_opens: true,
            track_clicks: false
        });

        console.log('Письмо отправлено:', response.data);
        return true;
    } catch (error) {
        console.error('Ошибка отправки письма:', error.response?.data || error.message);
        return false;
    }
};

module.exports = { sendConfirmationEmail };