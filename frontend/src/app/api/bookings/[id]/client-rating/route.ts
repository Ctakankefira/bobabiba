import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
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

  const { id } = await context.params;

  try {
    const payload = await request.json();
    const res = await axios.patch(
      `${process.env.BACKEND_URL}/bookings/${id}/client-rating`,
      payload,
      {
        headers: {
          Authorization: authorization,
        },
      },
    );

    return NextResponse.json(res.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: error.response?.data?.message ?? 'Failed to rate client' },
        { status: error.response?.status ?? 500 },
      );
    }

    return NextResponse.json({ error: 'Failed to rate client' }, { status: 500 });
  }
}
