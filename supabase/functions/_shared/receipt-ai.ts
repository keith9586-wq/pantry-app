// Shared Claude call used by parse-receipt (photos) and inbound-email (forwarded e-receipts).
import Anthropic from 'npm:@anthropic-ai/sdk';

const CATEGORIES = [
  'produce', 'dairy', 'eggs', 'meat', 'seafood', 'bakery', 'frozen',
  'grains', 'canned', 'condiments', 'snacks', 'beverages', 'other',
];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'store'],
  properties: {
    store: { type: ['string', 'null'], description: 'Store chain name as printed at the top, e.g. "Aldi", without store number or address; null if not shown' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'category', 'price', 'brand'],
        properties: {
          name: { type: 'string', description: 'Plain product name a shopper would say, e.g. "Whole milk", no brand codes' },
          quantity: { type: 'number' },
          unit: { type: 'string', description: 'each, lb, oz, kg, gal, pack' },
          category: { type: 'string', enum: CATEGORIES },
          price: { type: ['number', 'null'], description: 'Line total paid after discounts, null if unreadable' },
          brand: { type: ['string', 'null'], description: 'Brand as printed, expanded (e.g. "Great Value"), null for store produce or when unclear. Used to match food recalls.' },
        },
      },
    },
  },
};

const SYSTEM = `You read grocery receipts and return the food and household grocery items bought.
Expand store abbreviations into plain names (e.g. "GV WHL MLK 1G" is "Whole milk", 1 gal).
Keep the brand out of the name and put it in brand instead ("GV" is "Great Value"); use null when no brand is printed.
Skip totals, tax, payment lines, coupons, bag fees, deposits and anything that is not a product.
Apply line discounts to the item they belong to. When a weight is printed, use it as the quantity with its unit.
If the image or text is not a receipt, return an empty items list.`;

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

export interface ReceiptInput {
  image?: { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };
  text?: string;
}

export async function extractReceiptItems(input: ReceiptInput): Promise<{ items: unknown[]; store?: string | null }> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({ type: 'image', source: { type: 'base64', media_type: input.image.mediaType, data: input.image.data } });
  }
  if (input.text) content.push({ type: 'text', text: `Receipt text:\n\n${input.text}` });
  content.push({ type: 'text', text: 'List the items on this receipt.' });

  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    // Server-side fallback re-runs a declined request on another model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Extraction is routine work; low effort keeps latency and cost down.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') return { items: [] };
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return { items: [] };
  return JSON.parse(text.text);
}
