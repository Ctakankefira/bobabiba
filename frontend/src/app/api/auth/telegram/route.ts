import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  const { initData } = await request.json();
  try {
    const res = await axios.post(`${process.env.BACKEND_URL}/auth/telegram`, { initData });
    return NextResponse.json(res.data);
  } catch {
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }
}
