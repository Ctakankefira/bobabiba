import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type RegistrationSession = {
  step: 'name' | 'age' | 'role' | 'photo';
  displayName?: string;
  age?: number;
  role?: 'CLIENT' | 'MASTER';
};

type TelegramMessage = {
  chat?: { id: number };
  from?: TelegramUser;
  text?: string;
  photo?: Array<{ file_id: string; file_size?: number }>;
};

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly sessions = new Map<number, RegistrationSession>();

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    const botToken = this.configService.get<string>('BOT_TOKEN');
    const publicBackendUrl = this.configService.get<string>('PUBLIC_BACKEND_URL');

    if (!botToken || !publicBackendUrl) {
      this.logger.warn('BOT_TOKEN or PUBLIC_BACKEND_URL is missing, Telegram webhook was not configured');
      return;
    }

    try {
      const secretToken = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
      const webhookUrl = `${publicBackendUrl.replace(/\/+$/, '')}/telegram/webhook`;

      await this.callTelegram('setWebhook', {
        url: webhookUrl,
        ...(secretToken ? { secret_token: secretToken } : {}),
      });

      await this.callTelegram('setMyCommands', {
        commands: [
          { command: 'start', description: 'Открыть меню бота' },
          { command: 'register', description: 'Пройти регистрацию' },
          { command: 'profile', description: 'Показать профиль' },
          { command: 'master', description: 'Сменить роль на мастера' },
          { command: 'client', description: 'Сменить роль на клиента' },
          { command: 'help', description: 'Показать список команд' },
        ],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to configure Telegram webhook: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async handleUpdate(update: Record<string, unknown>) {
    const message = (update.message ?? update.edited_message) as TelegramMessage | undefined;
    if (!message?.chat?.id || !message.from) {
      return;
    }

    const chatId = message.chat.id;
    const telegramUser = message.from;
    const text = message.text?.trim();
    const session = this.sessions.get(chatId);
    const adminCode = this.configService.get<string>('ADMIN_BOT_CODE')?.trim();

    if (text && adminCode) {
      const normalizedText = text.replace(/^\/admin\s*/i, '').trim();
      if (normalizedText && normalizedText === adminCode) {
        const user = await this.findOrCreateUser(telegramUser);
        await this.usersService.setAdmin(user.id, true);
        this.sessions.delete(chatId);
        await this.sendMessage(
          chatId,
          'Админ-доступ активирован. В приложении теперь появится третий выбор: админ-панель.',
        );
        return;
      }
    }

    if (text?.startsWith('/')) {
      await this.handleCommand(chatId, telegramUser, text);
      return;
    }

    if (!session) {
      await this.sendMessage(
        chatId,
        'Я пока не понял сообщение. Используй /register для регистрации или /help для списка команд.',
      );
      return;
    }

    if (session.step === 'photo') {
      if (text === '/skip') {
        await this.finishRegistration(chatId, telegramUser, session, null);
        return;
      }

      if (message.photo?.length) {
        const avatarUrl = await this.resolveTelegramPhotoUrl(message.photo);
        await this.finishRegistration(chatId, telegramUser, session, avatarUrl);
        return;
      }

      await this.sendMessage(
        chatId,
        'Пришли фотографию одним сообщением или отправь /skip, если хочешь закончить без фото.',
      );
      return;
    }

    if (!text) {
      await this.sendMessage(chatId, 'Пока я понимаю только текстовые ответы на этом шаге.');
      return;
    }

    if (session.step === 'name') {
      this.sessions.set(chatId, { ...session, step: 'age', displayName: text });
      await this.sendMessage(chatId, 'Сколько тебе лет? Отправь возраст числом.');
      return;
    }

    if (session.step === 'age') {
      const age = Number(text);
      if (!Number.isInteger(age) || age < 18 || age > 100) {
        await this.sendMessage(chatId, 'Укажи возраст числом от 18 до 100.');
        return;
      }

      this.sessions.set(chatId, { ...session, step: 'role', age });
      await this.sendMessage(chatId, 'Кто ты в приложении?', {
        keyboard: [[{ text: 'Клиент' }, { text: 'Мастер' }]],
        oneTimeKeyboard: true,
        resizeKeyboard: true,
      });
      return;
    }

    if (session.step === 'role') {
      const normalized = text.toLowerCase();
      const role =
        normalized.includes('мастер') ? 'MASTER' : normalized.includes('клиент') ? 'CLIENT' : null;

      if (!role) {
        await this.sendMessage(chatId, 'Выбери роль кнопкой: Клиент или Мастер.');
        return;
      }

      this.sessions.set(chatId, { ...session, step: 'photo', role });
      await this.sendMessage(
        chatId,
        'Теперь пришли фото для профиля. Если фото пока нет, отправь /skip.',
        {
          removeKeyboard: true,
        },
      );
    }
  }

  private async handleCommand(chatId: number, telegramUser: TelegramUser, commandText: string) {
    const command = commandText.split(' ')[0].toLowerCase();

    if (command === '/start') {
      this.sessions.delete(chatId);
      await this.sendMessage(
        chatId,
        'Привет! Я помогу зарегистрироваться в сервисе. Используй /register, чтобы заполнить профиль, или /profile, чтобы посмотреть текущие данные.',
      );
      return;
    }

    if (command === '/help') {
      await this.sendMessage(
        chatId,
        ['/start — открыть меню', '/register — пройти регистрацию', '/profile — показать профиль', '/master — выбрать роль мастера', '/client — выбрать роль клиента'].join('\n'),
      );
      return;
    }

    if (command === '/register') {
      this.sessions.set(chatId, { step: 'name' });
      await this.sendMessage(chatId, 'Давай начнем регистрацию. Как тебя зовут?');
      return;
    }

    if (command === '/profile') {
      const user = await this.usersService.findByTelegramId(String(telegramUser.id));
      if (!user) {
        await this.sendMessage(chatId, 'Профиль еще не создан. Нажми /register, чтобы зарегистрироваться.');
        return;
      }

      await this.sendMessage(
        chatId,
        [
          `Имя: ${user.displayName ?? 'не указано'}`,
          `Возраст: ${user.age ?? 'не указан'}`,
          `Роль: ${user.role === 'MASTER' ? 'мастер' : 'клиент'}`,
          `Фото: ${user.avatarUrl ? 'загружено' : 'не загружено'}`,
        ].join('\n'),
      );
      return;
    }

    if (command === '/master' || command === '/client') {
      const user = await this.findOrCreateUser(telegramUser);
      const role = command === '/master' ? 'MASTER' : 'CLIENT';
      await this.usersService.updateRegistrationProfile(user.id, { role });
      await this.sendMessage(chatId, `Роль обновлена: ${role === 'MASTER' ? 'мастер' : 'клиент'}.`);
      return;
    }

    await this.sendMessage(chatId, 'Неизвестная команда. Используй /help, чтобы посмотреть доступные команды.');
  }

  private async finishRegistration(
    chatId: number,
    telegramUser: TelegramUser,
    session: RegistrationSession,
    avatarUrl: string | null,
  ) {
    const user = await this.findOrCreateUser(telegramUser);
    const normalizedUsername = telegramUser.username?.trim().replace(/^@+/, '').toLowerCase() || undefined;

    await this.usersService.updateRegistrationProfile(user.id, {
      displayName: session.displayName ?? user.displayName ?? telegramUser.first_name,
      age: session.age ?? user.age ?? null,
      role: session.role ?? user.role,
      avatarUrl,
    });

    if (
      normalizedUsername &&
      (user.username !== normalizedUsername || user.telegramId !== String(telegramUser.id))
    ) {
      await this.usersService.updateIdentity(user.id, {
        telegramId: String(telegramUser.id),
        username: normalizedUsername,
      });
    }

    this.sessions.delete(chatId);
    await this.sendMessage(
      chatId,
      [
        'Регистрация завершена.',
        `Имя: ${session.displayName ?? user.displayName ?? 'не указано'}`,
        `Роль: ${session.role === 'MASTER' ? 'мастер' : 'клиент'}`,
        avatarUrl ? 'Фото профиля сохранено.' : 'Профиль пока без фото.',
      ].join('\n'),
    );
  }

  private async findOrCreateUser(telegramUser: TelegramUser) {
    const telegramId = String(telegramUser.id);
    const username = telegramUser.username?.trim().replace(/^@+/, '').toLowerCase() || undefined;

    let user = await this.usersService.findByTelegramId(telegramId);
    if (!user && username) {
      user = await this.usersService.findByUsername(username);
      if (user) {
        user = await this.usersService.updateIdentity(user.id, { telegramId, username });
      }
    }

    if (!user) {
      user = await this.usersService.create({
        telegramId,
        username,
        displayName:
          [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ').trim() ||
          telegramUser.first_name,
        role: 'CLIENT',
      });
    }

    return user;
  }

  private async resolveTelegramPhotoUrl(photos: Array<{ file_id: string; file_size?: number }>) {
    const botToken = this.getBotToken();
    const bestPhoto = [...photos].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
    const fileResponse = await this.callTelegram('getFile', { file_id: bestPhoto.file_id });
    const filePath = fileResponse?.result?.file_path;
    if (!filePath) {
      throw new Error('Telegram file path is missing');
    }

    return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  }

  async notifyMasterAboutBooking(input: {
    telegramId: string;
    masterName?: string | null;
    clientName?: string | null;
    serviceName?: string | null;
    date: Date;
    notes?: string | null;
  }) {
    if (!input.telegramId) {
      return;
    }

    const chatId = Number(input.telegramId);
    if (!Number.isFinite(chatId)) {
      this.logger.warn(`Cannot send booking notification: invalid telegram id ${input.telegramId}`);
      return;
    }

    const dateText = input.date.toLocaleString('ru-RU');
    const lines = [
      'Новая заявка',
      input.masterName ? `Мастер: ${input.masterName}` : null,
      input.clientName ? `Клиент: ${input.clientName}` : null,
      input.serviceName ? `Услуга: ${input.serviceName}` : null,
      `Дата: ${dateText}`,
      input.notes ? `Комментарий: ${input.notes}` : null,
    ].filter(Boolean);

    await this.sendMessage(chatId, lines.join('\n'));
  }

  private async sendMessage(
    chatId: number,
    text: string,
    options?: {
      keyboard?: Array<Array<{ text: string }>>;
      oneTimeKeyboard?: boolean;
      resizeKeyboard?: boolean;
      removeKeyboard?: boolean;
    },
  ) {
    const reply_markup = options?.removeKeyboard
      ? { remove_keyboard: true }
      : options?.keyboard
        ? {
            keyboard: options.keyboard,
            resize_keyboard: options.resizeKeyboard ?? true,
            one_time_keyboard: options.oneTimeKeyboard ?? false,
          }
        : undefined;

    await this.callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      ...(reply_markup ? { reply_markup } : {}),
    });
  }

  private async callTelegram(method: string, body: Record<string, unknown>) {
    const botToken = this.getBotToken();
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Telegram API ${method} failed with status ${response.status}`);
    }

    return response.json();
  }

  private getBotToken() {
    const botToken = this.configService.get<string>('BOT_TOKEN');
    if (!botToken) {
      throw new Error('BOT_TOKEN is not configured');
    }

    return botToken;
  }
}
