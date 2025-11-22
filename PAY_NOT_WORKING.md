PAY NOT WORKING

What is wrong
-------------
- Customer "Pay" and provider "Get Pay Link" can fail locally when Stripe is not set up.

Current local workaround
------------------------
- Set `INVOICE_DEBUG_ENABLED=true` in the backend and use the debug link returned by the server. Opening that link marks the invoice paid for demos.

Where to look in code
---------------------
- `repairconnect-backend/server.js` — `/invoices/:id/create-checkout`, `/debug/pay-invoice/:id`
- `repairconnect-frontend/src/services/api.js` — `createInvoiceCheckout`, `debugPayInvoice`
- `repairconnect-frontend/src/components/InvoiceCenter.js` — customer pay UI
- `repairconnect-frontend/src/components/MyJobs.js` — provider Get Pay Link UI
- `repairconnect-frontend/src/components/Notifications.js` — notifications (Pay removed)

How to run a quick local test
-----------------------------
1. Enable debug-pay and restart backend (example):

   INVOICE_DEBUG_ENABLED=true INVOICE_DEBUG_SECRET=dev-debug API_BASE_URL=http://localhost:8081 npm run start

2. Get an invoice id (use `node repairconnect-backend/scripts/list_invoices.js`) and run:

   curl -i "http://localhost:8081/debug/pay-invoice/<invoiceId>?secret=dev-debug"

How to fix for real
-------------------
1. Configure Stripe:
   - Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
   - Expose backend webhook (eg. `ngrok http 8081`) and set webhook secret.
   - Set `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL`.

2. Add logging around Stripe session creation and webhook handling.

Notes
-----
- The debug route is for local testing only — do not enable it in production without protection.
- Search the code for "PAY NOT WORKING" or "NOTE (PAY NOT WORKING)" for inline comments added to help debugging.
