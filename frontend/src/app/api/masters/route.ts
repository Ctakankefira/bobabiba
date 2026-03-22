import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = Object.fromEntries(searchParams);

  if (!process.env.BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL is not configured' },
      { status: 500 },
    );
  }

  try {
    const res = await axios.get(`${process.env.BACKEND_URL}/masters`, { params: query });
    return NextResponse.json(res.data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch masters' }, { status: 500 });
  }
}
