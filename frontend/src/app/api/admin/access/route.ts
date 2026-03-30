import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

function normalizeUsername(value?: string | null) {
  return value?.trim().replace(/^@/, '').toLowerCase() ?? '';
}

function isAllowedAdmin(user: {
  isAdmin?: boolean;
  username?: string | null;
  telegramId?: string | null;
}) {
  if (user.isAdmin) {
    return true;
  }

  const adminUsername = normalizeUsername(process.env.ADMIN_USERNAME);
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID?.trim() ?? '';

  if (!adminUsername && !adminTelegramId) {
    return false;
  }

  if (adminUsername && normalizeUsername(user.username) === adminUsername) {
    return true;
  }

  if (adminTelegramId && (user.telegramId ?? '') === adminTelegramId) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ allowed: false }, { status: 401 });
  }

  try {
    const res = await axios.get(`${process.env.BACKEND_URL}/users/profile`, {
      headers: {
        Authorization: authorization,
      },
    });

    return NextResponse.json({ allowed: isAllowedAdmin(res.data) });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: error.response?.data?.message ?? 'Failed to check admin access', allowed: false },
        { status: error.response?.status ?? 500 },
      );
    }

    return NextResponse.json({ error: 'Failed to check admin access', allowed: false }, { status: 500 });
  }
}
