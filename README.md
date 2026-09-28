# Driftwood Supply Co.

A headless Shopify storefront built with **plain HTML, CSS, and JavaScript**: no framework, no build step. Products, cart, and checkout all come from a real Shopify store through the Storefront API.

**▶ Live store: https://driftwood-supply.vercel.app**

## Features

- **Catalog:** product grid with instant search, category filters with counts, and sorting (price, newest, name). Filters are saved in the URL, so a filtered view can be shared.
- **Product pages:** image gallery, option pickers (size, color, grind…) that switch the price, stock, and photo for the selected variant, sold-out options crossed out, sale prices, and a quantity stepper.
- **Real Shopify cart:** a slide-out cart drawer using Shopify's Cart API. Quantities and totals always match Shopify, and the cart survives page reloads.
- **Checkout:** hands off to Shopify's secure checkout.
- Loading skeletons, empty and error states, keyboard-friendly controls, and a responsive layout that works on phones.

## How it works

```
Browser ── fetch() + GraphQL ──► Shopify Storefront API
  │                                  ├─ products, variants, images, prices, stock
  │                                  └─ Cart API: create cart, add/update/remove lines
  └── "Check out" ─────────────────► Shopify checkout (cart.checkoutUrl)
```

| File | What it does |
|---|---|
| `js/config.js` | Store domain, public Storefront token, API version |
| `js/api.js` | Every GraphQL query and cart mutation, with error handling in one place |
| `js/cart.js` | Cart state (saved by cart id in localStorage) and the cart drawer |
| `js/catalog.js` | Home page: search, filters, sorting, product cards |
| `js/product.js` | Product page: gallery, variant selection, add to cart |
| `js/utils.js` | Money formatting, safe DOM builder, responsive Shopify CDN images |
| `css/styles.css` | All styles, with design tokens as CSS custom properties |
| `shopify/products.csv` | Sample catalog to import into a Shopify store |

**Security notes**

- The Storefront token in `config.js` is Shopify's *public* token. It's designed for browser code and can only read products and manage carts, never orders, customers, or admin data.
- Product text is always inserted with `textContent` / DOM nodes (never `innerHTML`), so store content can't inject markup or scripts.

## Run it locally

Any static file server works:

```bash
npm start            # serves the site at http://localhost:3000
npm test             # unit tests (Node's built-in test runner)
```

## Use your own store

1. In your Shopify admin, install the **Headless** channel and create a storefront.
2. Copy its **public** Storefront access token into `js/config.js` along with your `*.myshopify.com` domain.
3. Import `shopify/products.csv` (**Products → Import**) for the sample catalog.
4. Make sure your products are available on the Headless channel.

## Credits

Product photos are from [Burst](https://www.shopify.com/stock-photos), Shopify's free stock photo library.
