import { NextResponse } from 'next/server';
import { getGameState } from '@/lib/gameStore';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return new NextResponse('Missing photo id', { status: 400 });
  }

  const state = await getGameState();
  const photo = (state.photos || []).find((p) => p.id === id);
  if (!photo || !photo.imageData) {
    return new NextResponse('Photo not found', { status: 404 });
  }

  const dataUrl = photo.imageData;
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return new NextResponse('Invalid image format', { status: 400 });
  }

  const mimeType = match[1] || 'image/jpeg';
  const buffer = Buffer.from(match[2], 'base64');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  });
}
