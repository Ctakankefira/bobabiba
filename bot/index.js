const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('Добро пожаловать в Маркетплейс Мастеров!', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть приложение', web_app: { url: process.env.WEB_APP_URL } }]
      ]
    }
  });
});

bot.command('profile', async (ctx) => {
  const telegramId = ctx.from.id;
  try {
    // Предполагаем, что токен хранится в сессии или базе, но для простоты используем заглушку
    const response = await axios.get(`${process.env.BACKEND_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${process.env.JWT_TOKEN}` } // Нужно реализовать аутентификацию
    });
    ctx.reply(`Ваш профиль: ${JSON.stringify(response.data)}`);
  } catch (e) {
    ctx.reply('Пожалуйста, войдите через приложение');
  }
});

bot.command('my_bookings', async (ctx) => {
  const telegramId = ctx.from.id;
  try {
    const response = await axios.get(`${process.env.BACKEND_URL}/bookings`, {
      headers: { Authorization: `Bearer ${process.env.JWT_TOKEN}` }
    });
    ctx.reply(`Ваши записи: ${JSON.stringify(response.data)}`);
  } catch (e) {
    ctx.reply('Ошибка получения записей');
  }
});

// Функция для отправки уведомлений
async function sendNotification(chatId, message) {
  await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text: message
  });
}

module.exports = { sendNotification };

bot.launch();