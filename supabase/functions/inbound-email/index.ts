// Receives forwarded e-receipt emails from an inbound-email provider webhook
// (Postmark-style JSON: To, From, Subject, TextBody, HtmlBody) and files the parsed
// items as a pending receipt for the household to confirm in the app.
//
// Each household gets an address like  r-<inbox_code>@receipts.<your-domain>
// Set INBOUND_EMAIL_SECRET and call this URL with ?secret=<value> from the provider.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractReceiptItems } from '../_shared/receipt-ai.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method !== 'POST' || url.searchParams.get('secret') !== Deno.env.get('INBOUND_EMAIL_SECRET')) {
    return new Response('Forbidden', { status: 403 });
  }
  const mail = await req.json();
  const to: string = mail.OriginalRecipient ?? mail.To ?? '';
  const code = to.match(/r-([a-z0-9]{6,32})@/i)?.[1]?.toLowerCase();
  if (!code) return new Response('Unknown inbox', { status: 200 }); // 200 so the provider does not retry

  const { data: household } = await supabase.from('households').select('id').eq('inbox_code', code).maybeSingle();
  if (!household) return new Response('Unknown inbox', { status: 200 });

  const text = (mail.TextBody?.trim() || htmlToText(mail.HtmlBody ?? '')).slice(0, 50_000);
  if (!text) return new Response('Empty email', { status: 200 });

  const { items } = await extractReceiptItems({ text: `Subject: ${mail.Subject ?? ''}\n\n${text}` });
  await supabase.from('pending_receipts').insert({
    household_id: household.id,
    source: 'email',
    sender: mail.From ?? null,
    subject: mail.Subject ?? null,
    items,
  });
  return new Response('ok');
});
