import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET is not configured' },
      { status: 500 },
    );
  }

  try {
    const payload = await request.json();
    const res = await axios.post(`${process.env.BACKEND_URL}/masters`, payload, {
      headers: {
        'x-admin-secret': process.env.ADMIN_SECRET,
      },
    });

    return NextResponse.json(res.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: error.response?.data?.message ?? 'Failed to create master' },
        { status: error.response?.status ?? 500 },
      );
    }

    return NextResponse.json({ error: 'Failed to create master' }, { status: 500 });
  }
}
