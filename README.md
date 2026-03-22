# Telegram Mini App - Маркетплейс Мастеров

Платформа для мастеров услуг, где клиенты могут записываться онлайн.

## 🚀 Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
git clone <your-repo>
cd tgbot
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../bot && npm install
```

### 2. Настройка Telegram бота

1. Перейдите к [@BotFather](https://t.me/botfather) в Telegram
2. Создайте нового бота командой `/newbot`
3. Получите `BOT_TOKEN`
4. Настройте Web App: `/setmenubutton` → введите URL вашего Vercel приложения

### 3. Локальная разработка

```bash
# Запуск всех сервисов
docker-compose up --build

# Или по отдельности:
# Backend
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev

# Bot
cd bot && npm run dev
```

### 4. Деплой

#### Backend (Railway)
1. Создайте аккаунт на [Railway](https://railway.app)
2. Подключите GitHub репозиторий
3. Добавьте переменные окружения:
   - `DATABASE_URL`
   - `BOT_TOKEN`
   - `JWT_SECRET`
   - `WEB_APP_URL`
   - `BACKEND_URL`

#### Database (Railway PostgreSQL)
1. В Railway добавьте PostgreSQL плагин
2. Скопируйте `DATABASE_URL`
3. Запустите миграции: `npx prisma migrate deploy`

#### Frontend (Vercel)
1. Подключите GitHub к [Vercel](https://vercel.com)
2. Добавьте переменные:
   - `BACKEND_URL` (URL вашего Railway backend)

#### Bot (Railway)
1. Разверните как отдельный сервис
2. Добавьте переменные:
   - `BOT_TOKEN`
   - `BACKEND_URL`
   - `WEB_APP_URL`

## 📋 API Эндпоинты

### Аутентификация
- `POST /auth/telegram` - авторизация через Telegram initData

### Мастера
- `GET /masters` - список мастеров с фильтрами
- `GET /masters/:id` - профиль мастера
- `POST /masters` - создать профиль мастера

### Записи
- `GET /bookings` - мои записи
- `POST /bookings` - создать запись

## 🔧 Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения.

## 🧪 Тестирование

```bash
# Backend тесты
cd backend && npm run test

# E2E тесты
cd backend && npm run test:e2e
```

## 📚 Документация

- [NestJS](https://docs.nestjs.com/)
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Telegraf](https://telegraf.js.org/)
- [Telegram Web Apps](https://core.telegram.org/bots/webapps)