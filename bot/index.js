const { Telegraf } = require('telegraf');

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(process.env.BOT_TOKEN);

function getAppUrl() {
  return process.env.WEB_APP_URL || 'https://example.com';
}

bot.start((ctx) => {
  ctx.reply('Добро пожаловать в маркетплейс мастеров.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Открыть приложение', web_app: { url: getAppUrl() } }],
      ],
    },
  });
});

bot.command('app', (ctx) => {
  ctx.reply('Открываю Mini App.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Перейти в каталог', web_app: { url: getAppUrl() } }],
      ],
    },
  });
});

bot.command('help', (ctx) => {
  ctx.reply(
    [
      'Команды:',
      '/start - приветствие и кнопка входа',
      '/app - открыть приложение',
      '/help - список команд',
    ].join('\n'),
  );
});

bot.catch((error) => {
  console.error('Bot error:', error);
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
