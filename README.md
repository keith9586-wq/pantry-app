# Pantry

A phone app (iOS and Android) that keeps track of what's in your fridge, freezer and pantry without you typing it in, and shows how much grocery money you actually eat versus throw away.

## What works today

- **Away mode.** Settings → Going away: pick when you leave and for how long. The app lists what would spoil (freeze it in one tap, or eat it first, with dinners added to the plan on Plus), keeps fresh food off the self-filling list from the day before you leave, and pauses use-by reminders until you're back.
- **Receipt scanning.** Take a photo of a receipt (or paste e-receipt text). Store shorthand like `GV WHL MLK 1G` becomes "Whole Milk", and each item lands in your kitchen.
- **Predicted use-by dates.** Every item gets an estimated date from what it is and where it's kept. Moving milk to the freezer re-estimates it.
- **Barcode scanning.** Scan a package to add it, looked up in [Open Food Facts](https://world.openfoodfacts.org).
- **Accurate by design.** Tap any item to fix its name, date or storage spot, log part of it ("used 2 of 12 eggs"), or mark how much is left. Every change shows an Undo bar for 6 seconds.
- **Use-it-up.** Food expiring within 3 days sits at the top of the Kitchen tab.
- **Cook from what you have.** Recipes are ranked by how many ingredients you already own, with a boost for ones that use food about to expire. "I made this" deducts the ingredients.
- **Auto shopping list.** Things you've bought at least twice are added when they run out or run low, grouped by store aisle. Checked items can be put straight into the kitchen.
- **Money saved and wasted.** The Savings tab shows what you ate vs. threw out this month, your waste rate, and the items you throw out most.

- **Welcome screens.** New installs get four short screens: what the app does, just me or a household, optional reminders and diet, then scan a receipt, try sample groceries or start empty. People upgrading from an earlier build skip them.
- **Household sharing.** Tap Household on the Kitchen tab to create a household or join one with an invite code. The kitchen, shopping list, history, your own recipes and price history then sync across everyone's phones with live updates. Everyone's diets and allergies are shared too, so the Recipes tab can show only recipes that fit all of you (tap the chip to switch to just yours). People start with an anonymous account, so there's no sign-up form.
- **Forwarded e-receipts.** Each household gets its own email address. Forwarded receipts are read on the server and wait in the Scan tab for a quick check before they're added.

- **Use-by reminders.** One notification the morning before food expires, grouped per day. Tapping it opens recipes that use those items. You can turn it on from the Kitchen tab or in Settings.
- **Accounts.** Everyone starts with an anonymous account. In Settings you can save it with your email (a 6-digit code) and sign in on a new phone to get your household back.
- **Weekly meal planner.** Add a recipe to any of the next 7 days from its page, then see the week on the Recipes tab under "This week" with one list of what you still need to buy. Long-press a planned meal to remove it.
- **Price tracking.** Every scanned receipt records what you paid per unit. When you check a new receipt, each line says whether it's more or less than usual. The Savings tab lists price jumps and what you usually pay, and the shopping list shows a rough total from your last prices.
- **Your own recipes.** "Add your own recipe" on the Recipes tab takes a name, time, servings, and ingredients and steps typed or pasted one per line ("1 1/2 cups flour", "1 onion, chopped", "salt to taste"). You can also paste a link from almost any recipe site (anything that publishes schema.org Recipe data, which Google requires for recipe cards) and the form fills itself in. They're ranked with the built-in ones, work in the meal planner and "I made this", and can be edited or deleted.
- **Diet and allergies.** In Settings, pick diets (vegetarian, vegan, pescatarian, gluten-free, dairy-free), allergies and foods you don't eat. Recipes that don't fit are hidden, optional ingredients that don't fit are marked "leave out", and a recipe page warns you if it conflicts. Scanning a barcode checks the product's label (Open Food Facts allergens, "may contain" traces and vegan/vegetarian analysis) against your allergies and diet. Free for everyone.
- **Plans.** Free includes 5 receipt photo scans a month, barcode scanning, manual entry and use-by tracking. Plus ($4.99/month) unlocks unlimited scans, recipes, the weekly meal planner, the self-filling list and the Savings tab with price tracking. Family ($7.99/month) adds a shared household of up to 6 people and email forwarding; joining someone's household is free. Purchases go through RevenueCat. Until its keys are set, every feature is unlocked.

Without a backend configured, the app runs fully on the phone and the sharing screen explains what to set up.

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
| `functions/revenuecat-webhook` | Marks a household as Family while its owner's subscription is active, so every member gets Family features. |
| `migrations/0004_shared_extras.sql` | `recipes`, `prices` and `member_diets` tables. Members read everyone's diet but can only write their own. |
| `migrations/0003_family_plan.sql` | `family_until` on households, and a 6-person limit on joining. |
| `migrations/0002_sync.sql` | Phone-generated ids for history events, leaving a household, and `updated_at` / `updated_by` stamps. |

Setup:

```bash
supabase link --project-ref <your-project>
supabase db push
supabase secrets set ANTHROPIC_API_KEY=<key> INBOUND_EMAIL_SECRET=<random string>
supabase functions deploy parse-receipt
supabase functions deploy inbound-email
cp .env.example .env   # then fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
```

In the Supabase dashboard, turn on **Anonymous sign-ins** (Authentication → Providers) so household sharing works without a sign-up form. For email sign-in by code, edit the **Magic Link** and **Change Email Address** email templates (Authentication → Email Templates) to include `{{ .Token }}`, so the email contains the 6-digit code.

For email forwarding, set `EXPO_PUBLIC_RECEIPT_EMAIL_DOMAIN` in `.env` to the domain your provider receives mail for, and point the provider (for example Postmark inbound) at
`https://<project>.supabase.co/functions/v1/inbound-email?secret=<INBOUND_EMAIL_SECRET>`.

The Anthropic API key only ever lives in Supabase secrets, never in the app.

### Subscriptions (RevenueCat)

1. Create products in App Store Connect and Google Play (monthly Plus and Family, each with a 7-day free trial).
2. In RevenueCat, add both apps, create entitlements named exactly `plus` and `family`, attach the products, and put a Plus and a Family package in the current offering (product ids containing "plus" / "family").
3. Put the public SDK keys in `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
4. Deploy `revenuecat-webhook`, set `supabase secrets set REVENUECAT_WEBHOOK_AUTH=<random string>`, and add the webhook in RevenueCat with that value as the Authorization header.

In-app purchases need a development build (`npx expo run:ios` / `run:android` or EAS Build); Expo Go can't make real purchases.

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
src/sync/         Supabase client, household create/join, two-way sync engine, emailed receipts
src/data/         starter recipes
supabase/         backend functions and database schema
```

## Launch kit

- `docs/store-listing.md` has the App Store and Play copy, keywords, screenshot list, privacy questionnaire answers and a pre-submit checklist.
- `docs/privacy-policy.md` is a privacy policy that matches what the app actually does. Fill in the brackets and host it.
- `assets/` has the app icon, Android adaptive icon layers (green background, jar-and-leaf foreground, monochrome) and favicon.

## Next steps

1. Open shared recipe links straight into the app (share sheet).
2. A Claude fallback for recipe pages without structured data.
