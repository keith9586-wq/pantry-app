# Pantry privacy policy

_Last updated: [DATE]. Replace the bracketed parts before publishing._

Pantry ("the app") is made by [YOUR NAME OR COMPANY]. This policy explains what the app collects, why, and what you can do about it. Questions: [CONTACT EMAIL].

## The short version

- Your kitchen lives on your phone. It only goes to our servers if you share a household or save your account.
- We don't sell your data, show ads, or track you across other apps.
- Receipt photos are read and then discarded. We don't keep them.

## What we collect and why

**Your kitchen, shopping list and history.** Items, quantities, use-by dates, prices, your own recipes and what you used or threw out. These stay on your phone. If you create or join a household, they're stored on our servers (Supabase) so everyone in the household sees the same kitchen. People in your household can see and change them.

**Account.** When you open the app, it makes an anonymous account with a random id so the household features work. There's no name or password. If you choose "Save with email", we store your email address so you can sign in on a new phone. Sign-in codes are sent by email.

**Diet, allergies and foods you don't eat.** Saved on your phone. If you're in a household, the other members can see them, so recipes can fit everyone. Allergy information is health-related, so it's never used for anything else and is deleted when you leave the household.

**Receipt photos and text.** When you scan a receipt, the photo or text goes to our server, which asks Anthropic's Claude model to read the items and prices. We don't store the photo. Anthropic processes it under its commercial terms, doesn't use it to train its models, and deletes it after a limited retention period. Only the item list comes back to your phone.

**Forwarded e-receipt emails.** If you forward a receipt to your household's address, we read the email's text in the same way. We keep the sender, subject and the list of items until someone in your household confirms or dismisses it. We don't keep the email itself.

**Barcodes.** When you scan a barcode, the app looks up the number on Open Food Facts, a public product database. Only the barcode number is sent.

**Purchases.** Subscriptions go through Apple or Google and are managed by RevenueCat. We receive whether your subscription is active and the anonymous account id it belongs to. We never see your card details.

**Notifications.** Use-by reminders are scheduled on your phone. Nothing about them is sent to us.

## What we don't collect

No location, contacts, advertising id, browsing history, or analytics or tracking SDKs.

## Who else handles your data

- **Supabase** stores household data and accounts. [REGION]
- **Anthropic** reads receipt photos and text.
- **RevenueCat**, **Apple** and **Google** handle subscriptions.
- **Open Food Facts** gets barcode numbers.
- **[EMAIL PROVIDER, e.g. Postmark]** receives forwarded e-receipts.

Each one handles data only to provide its part of the service.

## Keeping and deleting your data

- Data on your phone is deleted when you delete the app.
- Leaving a household (Settings, then Household) removes you and your diet from it. The household's shared kitchen stays with the remaining members.
- To delete your account and everything tied to it, email [CONTACT EMAIL] from the address on your account, or from the app's support link. We'll do it within 30 days.

## Children

Pantry isn't directed at children under 13, and we don't knowingly collect their data.

## Changes

If this policy changes in a way that matters, we'll say so in the app before it takes effect.
