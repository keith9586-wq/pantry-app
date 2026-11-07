# Store listing kit

Copy and answers for App Store Connect and Google Play. Character limits are noted. Replace anything in [brackets].

## Names and short text

- **App name** (30): `Pantry: Food Waste Tracker`
- **Subtitle, iOS** (30): `Scan receipts, waste less food`
- **Short description, Play** (80): `Scan grocery receipts, get use-by reminders and cook what's about to expire.`
- **Promotional text, iOS** (170): `New: plan your week, track grocery prices from your receipts, and filter recipes for everyone's diet at home.`
- **Keywords, iOS** (100, comma separated, no spaces): `pantry,fridge,grocery,receipt,expiration,food waste,meal planner,shopping list,leftovers,inventory`
- **Category:** Food & Drink (primary), Productivity (secondary)
- **Age rating:** 4+ / Everyone

## Description

Most families throw out about a quarter of the food they buy. Pantry helps you eat it instead.

SCAN A RECEIPT, NOT EVERY ITEM
Snap your grocery receipt or forward an e-receipt, and everything you bought lands in your kitchen with a predicted use-by date. Barcode scanning and quick typing cover the rest.

KNOW WHAT TO USE FIRST
A "Use soon" list and one morning reminder before food expires. No notification spam.

COOK FROM WHAT YOU HAVE
Recipes ranked by what's already in your kitchen and what's about to go off. Tap "I made this" and the ingredients come out of your kitchen automatically. Add your own recipes by pasting them in.

PLAN THE WEEK
Put recipes on days and get one shopping list for everything you're missing.

SEE THE MONEY
Track dollars eaten versus thrown out each month, the foods you waste most, and when your usual groceries get pricier.

SHARE ONE KITCHEN
Everyone at home sees the same kitchen and shopping list, live. Diets and allergies are shared, so recipes fit everyone.

SAFE FOR ALLERGIES
Set allergies and diets once. Recipes that don't fit are hidden, and scanning a barcode warns you about allergens on the label.

Pantry Plus: unlimited receipt scans, recipes, meal planner, the self-filling shopping list and savings. Pantry Family: everything in Plus for up to 6 people. Both start with a 7-day free trial. Subscriptions renew automatically unless cancelled at least 24 hours before the period ends. Manage them in your account settings.

Privacy policy: [URL]  ·  Terms: [URL]

## Screenshots (6.9" iPhone and phone for Play)

Use the "Try it with sample groceries" option on the welcome screen, so every screen has realistic data.

1. Kitchen tab with the Use soon section. Caption: "Know what to use first"
2. Scan tab reviewing a receipt, with a "12% more than usual" price. Caption: "Scan a receipt, skip the typing"
3. Recipes tab with "Uses up: Spinach". Caption: "Cook what's about to expire"
4. This week plan with "Still need for this week". Caption: "Plan the week in a minute"
5. Savings tab. Caption: "See the money you save"
6. Household screen or the "Fits all 3 of you" chip. Caption: "One kitchen for the whole family"

## App Store privacy answers ("App Privacy")

- **Data used to track you:** None.
- **Data linked to you:**
  - Contact info: email address (only if the user saves their account). Purpose: app functionality.
  - Health and fitness: none. Allergies and diet are food preferences entered by the user, and Apple's "Health" category covers medical records and HealthKit data. Declare them under "Other user content" if review asks.
  - User content: other user content (kitchen items, recipes, receipts). Purpose: app functionality.
  - Purchases: purchase history (subscription status via RevenueCat). Purpose: app functionality.
  - Identifiers: user id (anonymous account id). Purpose: app functionality.
- **Not collected:** location, contacts, browsing history, usage data, diagnostics, advertising data.

## Google Play data safety answers

- Data collected: email address (optional), user ids, purchase history, other user-generated content (photos of receipts are processed but not stored).
- Shared with third parties: no. Processors like Supabase, Anthropic and RevenueCat count as service providers, not sharing.
- Encrypted in transit: yes. Users can request deletion: yes, by email (the contact address in `docs/privacy-policy.md`).
- Photos: "Processed ephemerally" for receipt photos.

## Review notes for Apple

The app works without signing in. To test subscriptions, use a sandbox account; Plus and Family both offer a 7-day trial. To see the app with data, choose "Try it with sample groceries" on the last welcome screen. Household sharing can be tested on one device by creating a household in Settings, then Household.

## Before you submit

- [ ] Replace the temporary contact email. It's in one place, the **Contact** line at the top of `docs/privacy-policy.md`. Use the same address as the support email in both stores.
- [ ] Fill in the Supabase region in `docs/privacy-policy.md`, then host it (a GitHub Pages site or Notion page works). Put the URL in both stores and in the description.
- [x] Bundle id and package name are `com.keith9586.pantry` in `app.json`. These can't change after the first upload.
- [ ] Create the Plus and Family subscriptions in both stores (see README, Subscriptions).
- [ ] Add a support URL or email (both stores require one).
