# MerchantOS — UI/UX Plan (BharatPe / PhonePe / Paytm killer)

## Mission
Replace PhonePe / Paytm / BharatPe merchant accounts for Indian SMBs.
**Same look-and-feel. Zero fees. Full data ownership.**

## Research findings (real product intel)

### Indian UPI merchant market
- UPI processes 20B transactions/month (Aug 2025), 50% of world's digital payments
- UPI itself is 0% (MDR nullified 2019 by Ministry of Finance)
- PhonePe, Paytm, BharatPe charge merchants via:
  - Settlement delays (T+1, T+2)
  - Wallet load fees
  - Premium "business" subscriptions
  - Paytm Soundbox: ₹999 + monthly subscription
  - POS device rentals
- Merchant complaints (Reddit/Play Store reviews): hidden fees, delayed settlements, opaque chargebacks, customer data locked

### BharatPe for Business — actual features
- All-in-One QR (accept any UPI app)
- POS devices (Soundbox, card machines)
- Business loans
- Real-time voice alerts
- Co-branded credit cards
- Bill payments
- Scan & Pay

### Paytm for Business — actual features
- All-in-One QR, Dynamic QR
- Soundbox (₹999 device, monthly fee)
- Card machine / POS
- Payment Links
- Payment Gateway (online)
- Subscriptions / recurring
- UPI / Card acceptance
- Instant settlements (premium)
- Paytm Invoices
- Paytm Business App
- Refunds
- Business analytics

### PhonePe for Business — actual features
- Accept all UPI payments
- QR code stickers
- Business insights
- Settlement history
- Refunds
- Customer support

## The killer insights (what we beat them on)

1. **0% commission forever** — we don't take any cut, ever
2. **Instant settlement** — money goes directly to your bank, not a PhonePe wallet with T+1 delay
3. **Your data, your server** — not their cloud
4. **No Soundbox needed** — the screen IS the speaker; browser push notifications
5. **No subscription tiers** — all features free
6. **One app, not three** — POS + Khata + Payments + Invoicing + Reports in one

## UI Plan: PhonePe-style merchant dashboard

### Visual language (BharatPe / PhonePe inspired)
- **Color**: Purple/violet primary (PhonePe signature: #5f259f) with cyan/green accents
- **Layout**: Mobile-first, bottom tab bar (3-4 sections), single-column on mobile
- **Top of every screen**: Merchant name + store selector + profile
- **Cards**: Rounded 16-20px, soft shadows, gradient headers for important amounts
- **Amounts**: Always large, always gradient, always `₹` prefix
- **Buttons**: Pill-shaped primary action, full-width
- **Empty states**: Big emoji + 1 line + 1 button

### Information architecture (4 tabs)

**Tab 1: Home** (the dashboard)
- Hero card: "Today's collection" with the ₹ amount (gradient)
- Secondary KPIs: Bills count, Customers, Pending khata
- Quick action grid (8 tiles):
  1. 💳 Accept Payment (the killer button — biggest, gradient)
  2. 🛒 New Bill
  3. 👥 Khata
  4. 📦 Products
  5. 🧾 Recent Bills
  6. 💸 Expense
  7. 📊 Reports
  8. ⚙️ Settings
- "Recent transactions" list (last 10)
- "Accept payment" persistent floating button

**Tab 2: Khata (Customers)**
- Header: "Total outstanding ₹X from Y customers"
- Customer cards grid (avatars, name, balance prominent, color-coded)
- Search bar
- + Add customer (top right)
- Tap customer → modal with full ledger + add entry

**Tab 3: Bills (POS)**
- Header: "Today's sales ₹X"
- Bills list (newest first)
- State pill (FINALIZED/CANCELLED)
- + New bill (floating button)

**Tab 4: More**
- Products management
- Suppliers
- Expenses
- Reports
- Shifts
- Settings (store info, users, change password)
- About / Help
- Logout

### The killer flow: "Accept Payment"

PhonePe/Paytm's "Receive Money" flow:
1. Tap "Accept Payment"
2. Enter amount (big numeric pad, like UPI apps)
3. Add note (optional)
4. Tap "Generate QR"
5. Show QR code + amount + link
6. Customer scans & pays with any UPI app
7. Status updates live (CREATED → VERIFIED)
8. Sound + haptic on success
9. Receipt / share button

**Our version (simpler, no Soundbox):**
- Same flow, but:
  - QR code is the merchant's permanent QR (no need to re-generate each time)
  - Customer page is the polished public pay page we built
  - Browser push notifications on success (free, no device needed)
  - "Share link" via WhatsApp / SMS / QR
  - Auto-print to receipt printer (if connected)

### Customer pay page (already built, polish more)
- PhonePe customer pay page style
- Big amount, gradient text
- Status pill with auto-update
- "Pay with any UPI app" CTA
- "Or scan QR" option

## Implementation plan (1 pass)

### Phase 1: Build the merchant SPA (single-page app)
- 4-tab bottom navigation (mobile) / left sidebar (desktop)
- Home dashboard with hero, KPIs, quick actions, recent activity
- Accept Payment flow (amount entry → generate → live status → success)
- Khata tab (customer grid + modals)
- Bills tab (list + new)
- More tab (all other pages)

### Phase 2: Polish the customer pay page
- PhonePe-style customer experience
- Better QR display
- "Pay with any UPI app" instruction
- Auto-update

### Phase 3: The "0% commission" value prop
- Onboarding: "You save ₹X/year vs PhonePe"
- Reports: show "PhonePe would have charged ₹Y. You saved ₹Y."
- Settings: "Comparison calculator"

### Phase 4: PDF receipts (small but important)
- Generate PDF bill on checkout
- Share via WhatsApp / print

### Phase 5: PWA (installable on phone home screen)
- manifest.json
- service worker (basic)
- icons

## Now executing Phase 1-3 in one shot

Files to write:
- `api/src/landing/landing.controller.ts` — new merchant SPA
- `api/src/payment/payment.controller.ts` — keep HTML pay page
- `api/src/landing/landing.css` — extracted styles (if too long)
