import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: Context) {
  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  const { id } = await context.params;

  try {
    const res = await axios.get(`${process.env.BACKEND_URL}/masters/${id}`);
    return NextResponse.json(res.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        { error: error.response?.data?.message ?? 'Failed to load master' },
        { status: error.response?.status ?? 500 },
      );
    }

    return NextResponse.json({ error: 'Failed to load master' }, { status: 500 });
  }
}
