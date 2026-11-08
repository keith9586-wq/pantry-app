// POST { frames: [{ data: <base64 jpeg>, mediaType?: 'image/jpeg' }, ...] }  (1 to 8 frames from one sweep)
// Returns { items: [{ name, quantity, unit, category, storage, fill }] }.
// Deploy: supabase functions deploy scan-shelves ; uses the same ANTHROPIC_API_KEY secret as parse-receipt.
//
// Cost: the app sends at most 8 frames at 1024 px wide, about 1,050 input tokens each, so a full
// sweep is roughly 9k input and 1.5k output tokens, about $0.07 on claude-opus-5-5 ($4/$20 per M).
import Anthropic from 'npm:@anthropic-ai/sdk';

const MAX_FRAMES = 8;
const MAX_FRAME_BYTES = 1.5 * 1024 * 1024;

const CATEGORIES = [
  'produce', 'dairy', 'eggs', 'meat', 'seafood', 'bakery', 'frozen',
  'grains', 'canned', 'condiments', 'snacks', 'beverages', 'other',
];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'category', 'storage', 'fill'],
        properties: {
          name: { type: 'string', description: 'Plain product name a shopper would say, e.g. "Greek yogurt", no brand' },
          quantity: { type: 'number', description: 'How many separate packages or pieces are visible' },
          unit: { type: 'string', description: 'each, pack, bottle, jar, can, bag, carton, lb' },
          category: { type: 'string', enum: CATEGORIES },
          storage: { type: 'string', enum: ['fridge', 'freezer', 'pantry'] },
          fill: { type: 'string', enum: ['full', 'half', 'low'], description: 'How much is left; full when it cannot be seen' },
        },
      },
    },
  },
};

const SYSTEM = `You take stock of a kitchen from photos. The photos are frames from one slow sweep of a phone camera
across a fridge, freezer or pantry, in order, and neighbouring frames overlap.
List the food and drink you can see. Count each physical item once: if the same jar shows up in three frames, it is one jar.
Only count two of something when you can see two at the same time or in clearly different places.
Use plain generic names ("Ketchup", "Cheddar cheese", "Oat milk"). Read labels when you can, but do not guess brands.
Skip anything that is not food or drink, and skip items you cannot identify with reasonable confidence.
Set storage from what the frame shows (fridge shelves and door, a frosty freezer, or dry cupboard shelves).
Set fill from what is visible through the package; use "full" for sealed or opaque packages.
If the photos do not show food storage at all, return an empty items list.`;

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let body: { frames?: { data?: unknown; mediaType?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return new Response('Expected JSON', { status: 400 });
  }
  const frames = Array.isArray(body.frames) ? body.frames.filter((f) => typeof f?.data === 'string' && f.data) : [];
  if (frames.length === 0) return new Response('Send at least one frame', { status: 400 });
  if (frames.length > MAX_FRAMES) return new Response(`At most ${MAX_FRAMES} frames`, { status: 413 });
  if (frames.some((f) => ((f.data as string).length * 3) / 4 > MAX_FRAME_BYTES)) {
    return new Response('Frame too large, resize to about 1024 px wide', { status: 413 });
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  frames.forEach((f, i) => {
    const mediaType = (['image/jpeg', 'image/png', 'image/webp'].includes(f.mediaType as string)
      ? f.mediaType
      : 'image/jpeg') as MediaType;
    content.push({ type: 'text', text: `Frame ${i + 1} of ${frames.length}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: f.data as string } });
  });
  content.push({ type: 'text', text: 'List what is stored here, counting each item once across all frames.' });

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Counting what is on a shelf is routine; low effort keeps latency and cost down.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    // Logged so real per-sweep cost can be checked against the estimate above.
    console.log('scan-shelves usage', frames.length, response.usage.input_tokens, response.usage.output_tokens);
    if (response.stop_reason === 'refusal') return Response.json({ items: [] });
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return Response.json({ items: [] });
    return Response.json(JSON.parse(text.text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return new Response('Busy, try again shortly', { status: 429 });
    if (e instanceof Anthropic.APIError) return new Response(`Shelf scan service error ${e.status}`, { status: 502 });
    console.error(e);
    return new Response('Could not read the photos', { status: 500 });
  }
});
