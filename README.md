# Sunday Objects — Task 1 ecommerce store

A responsive storefront for the Task 1 brief, built with HTML, CSS, JavaScript, Express, and SQLite. Browse the collection, open product details, add pieces to a shopping bag, create an account, place an order, and review order history.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
cp .env.example .env
```

Set `SESSION_SECRET` in `.env` to a unique random value at least 32 characters long, then start the app:

```sh
npm run dev
```

Open <http://localhost:3000>. The server creates `data/shop.sqlite` and seeds the product collection the first time it starts.

## Features

- Product collection with live category filters and search.
- Individual product detail pages at `/product/<slug>`.
- Persistent shopping bag in the browser, with quantity controls and shipping threshold.
- Registration and sign-in with bcrypt password hashes and signed, HTTP-only session cookies.
- Checkout with delivery address validation, server-calculated prices, a stock check, and an order confirmation.
- SQLite tables for products, users, orders, order line items, and newsletter subscribers.
- Account page with the signed-in user's recent order history.
- Responsive layout for mobile and desktop.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Local and production server port (default `3000`) |
| `APP_ORIGIN` | Exact app origin checked for mutating API requests (default `http://localhost:3000`) |
| `SESSION_SECRET` | Secret used to sign 7-day session tokens; required, never commit it |
| `DATABASE_PATH` | SQLite file path (default `./data/shop.sqlite`) |
| `NODE_ENV` | Set to `production` to enable the Secure cookie flag; serve behind HTTPS |

## Checkout note

Checkout creates and stores an order using **pay on delivery** as a demo payment option. It does not charge a card or connect to a payment provider. Add a payment provider and its server-side credentials before accepting online payments.

Product photography loads from Unsplash, so product images need an internet connection. Replace the image URLs in `server.js` to use self-hosted product photos.

## Checks

```sh
npm run check
```
