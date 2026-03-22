import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ error: 'Authorization header is required' }, { status: 401 });
  }

  try {
    const res = await axios.get(`${process.env.BACKEND_URL}/bookings/me`, {
      headers: {
        Authorization: authorization,
      },
    });

    return NextResponse.json(res.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: error.response?.data?.message ?? 'Failed to load bookings' },
        { status: error.response?.status ?? 500 },
      );
    }

    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ error: 'Authorization header is required' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const res = await axios.post(`${process.env.BACKEND_URL}/bookings`, payload, {
      headers: {
        Authorization: authorization,
      },
    });

    return NextResponse.json(res.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: error.response?.data?.message ?? 'Failed to create booking' },
        { status: error.response?.status ?? 500 },
      );
    }

    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
