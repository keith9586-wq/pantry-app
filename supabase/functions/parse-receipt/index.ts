// POST { image: <base64 jpeg>, mediaType?: 'image/jpeg' } or { text: <receipt text> }
// Returns { items: [{ name, quantity, unit, category, price }] }.
// Deploy: supabase functions deploy parse-receipt ; supabase secrets set ANTHROPIC_API_KEY=...
import Anthropic from 'npm:@anthropic-ai/sdk';
import { extractReceiptItems } from '../_shared/receipt-ai.ts';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body: { image?: string; mediaType?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Expected JSON', { status: 400 });
  }
  if (!body.image && !body.text) return new Response('Send an image or text', { status: 400 });
  if (body.image && (body.image.length * 3) / 4 > MAX_IMAGE_BYTES) {
    return new Response('Image too large, max 5 MB', { status: 413 });
  }
  const mediaType = (['image/jpeg', 'image/png', 'image/webp'].includes(body.mediaType ?? '')
    ? body.mediaType
    : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp';

  try {
    const result = await extractReceiptItems({
      image: body.image ? { data: body.image, mediaType } : undefined,
      text: body.text?.slice(0, 50_000),
    });
    return Response.json(result);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return new Response('Busy, try again shortly', { status: 429 });
    if (e instanceof Anthropic.APIError) return new Response(`Receipt service error ${e.status}`, { status: 502 });
    console.error(e);
    return new Response('Could not read the receipt', { status: 500 });
  }
});
