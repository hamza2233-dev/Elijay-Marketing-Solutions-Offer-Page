# Offer Portal

Google Sheets-backed offer portal for Vercel.

## Structure
- public/index.html — existing portal UI with live Google Sheets offer sync
- api/_offers.js — Google Sheets offer helpers
- api/offers.js — GET/POST/PUT/DELETE offers
- api/admin-login.js — admin authentication
- api/apply.js — publisher application upload handler
- api/buyer-offer.js — buyer inquiry handler
- package.json
- vercel.json

## Google Sheet Offers headers
ID | Vertical | Type | Offer Name | Payout | Pay Term | States | Hours | Cap | CC | Qualifiers | Status | Zip List

Do not commit service-account JSON or private keys.

