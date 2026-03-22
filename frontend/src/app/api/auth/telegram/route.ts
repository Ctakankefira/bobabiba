import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  const { initData } = await request.json();
  try {
    const res = await axios.post(`${process.env.BACKEND_URL}/auth/telegram`, { initData });
    return NextResponse.json(res.data);
  } catch (error) {
    return NextResponse.json({ error: 'Auth failed' }, { status: 401 });
  }
}