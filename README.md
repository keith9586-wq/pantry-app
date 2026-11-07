# Pantry

A phone app (iOS and Android) that keeps track of what's in your fridge, freezer and pantry without you typing it in, and shows how much grocery money you actually eat versus throw away.

## What works today

- **Receipt scanning.** Take a photo of a receipt (or paste e-receipt text). Store shorthand like `GV WHL MLK 1G` becomes "Whole Milk", and each item lands in your kitchen.
- **Predicted use-by dates.** Every item gets an estimated date from what it is and where it's kept. Moving milk to the freezer re-estimates it.
- **Barcode scanning.** Scan a package to add it, looked up in [Open Food Facts](https://world.openfoodfacts.org).
- **Accurate by design.** Tap any item to fix its name, date or storage spot, log part of it ("used 2 of 12 eggs"), or mark how much is left. Every change shows an Undo bar for 6 seconds.
- **Use-it-up.** Food expiring within 3 days sits at the top of the Kitchen tab.
- **Cook from what you have.** Recipes are ranked by how many ingredients you already own, with a boost for ones that use food about to expire. "I made this" deducts the ingredients.
- **Auto shopping list.** Things you've bought at least twice are added when they run out or run low, grouped by store aisle. Checked items can be put straight into the kitchen.
- **Money saved and wasted.** The Savings tab shows what you ate vs. threw out this month, your waste rate, and the items you throw out most.

Data is stored on the phone for now. The household sharing backend is in `supabase/` and will be wired into the app next (see "Next steps").

## Run it

```bash
npm install
npx expo start
```

Open it with the Expo Go app on your phone (scan the QR code), or press `i` / `a` for a simulator.

Photo receipt scanning needs the server function below. Without it, the Scan tab still works with pasted receipt text and has a "Try a sample" button.

## Server (Supabase)

`supabase/` holds the backend:

| Path | What it does |
| --- | --- |
| `functions/parse-receipt` | Takes a receipt photo or text, asks Claude to read it, returns clean line items as JSON. |
| `functions/inbound-email` | Webhook for forwarded e-receipt emails. Each household gets an address like `r-<code>@receipts.<your-domain>`; parsed items wait in `pending_receipts` for someone to confirm. |
| `migrations/0001_households.sql` | Households, members, invite codes, shared items and shopping list, history for the money view, row-level security so people only see their own household. |

Setup:

```bash
supabase link --project-ref <your-project>
supabase db push
supabase secrets set ANTHROPIC_API_KEY=<key> INBOUND_EMAIL_SECRET=<random string>
supabase functions deploy parse-receipt
supabase functions deploy inbound-email
cp .env.example .env   # then fill in the function URL and anon key
```

For email forwarding, point an inbound-email provider (for example Postmark inbound) at
`https://<project>.supabase.co/functions/v1/inbound-email?secret=<INBOUND_EMAIL_SECRET>`.

The Anthropic API key only ever lives in Supabase secrets, never in the app.

## Checks

```bash
npm test          # logic tests: receipt parsing, expiry, recipe ranking, cooking, shopping list, money, barcode
npm run typecheck
```

## Project layout

```
src/app/          screens (Expo Router): Kitchen, Scan, Recipes, List, Savings, item editor, barcode, add
src/lib/          plain TypeScript logic with tests in src/lib/__tests__
src/store/        app state (zustand, saved on the device)
src/data/         starter recipes
supabase/         backend functions and database schema
```

## Next steps

1. Sign-in and household sync: create or join a household with an invite code, then sync items, the shopping list and history through Supabase with live updates.
2. Show pending emailed receipts in the Scan tab for one-tap confirmation.
3. Subscriptions (Plus and Family) with a free trial.
