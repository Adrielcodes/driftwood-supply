// Thin wrapper around Shopify's Storefront GraphQL API.
// Every request goes through shopifyFetch so errors are handled in one place.

import { SHOPIFY } from "./config.js";

const ENDPOINT = `https://${SHOPIFY.domain}/api/${SHOPIFY.apiVersion}/graphql.json`;

export class ShopifyError extends Error {}

export async function shopifyFetch(query, variables = {}) {
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY.storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ShopifyError("Couldn't reach the store. Check your connection and try again.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    const message = body.errors?.map((e) => e.message).join("; ") || `Request failed (${response.status})`;
    throw new ShopifyError(message);
  }
  return body.data;
}

/* ─── Products ─────────────────────────────────────────────── */

const IMAGE = `url altText width height`;
const MONEY = `amount currencyCode`;

const PRODUCT_CARD = `
  id
  handle
  title
  productType
  availableForSale
  createdAt
  featuredImage { ${IMAGE} }
  priceRange { minVariantPrice { ${MONEY} } maxVariantPrice { ${MONEY} } }
  compareAtPriceRange { maxVariantPrice { ${MONEY} } }
`;

// The catalog is small, so the storefront loads it once and filters, sorts,
// and searches in the browser: instant results, no extra requests.
export async function getAllProducts() {
  const products = [];
  let after = null;
  do {
    const data = await shopifyFetch(
      `query Products($after: String) {
        products(first: 100, after: $after, sortKey: BEST_SELLING) {
          edges { node { ${PRODUCT_CARD} } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after }
    );
    products.push(...data.products.edges.map((e) => e.node));
    after = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (after);
  return products;
}

export async function getProduct(handle) {
  const data = await shopifyFetch(
    `query Product($handle: String!) {
      product(handle: $handle) {
        ${PRODUCT_CARD}
        description
        images(first: 10) { edges { node { ${IMAGE} } } }
        options { name optionValues { name } }
        variants(first: 100) {
          edges {
            node {
              id
              title
              availableForSale
              selectedOptions { name value }
              price { ${MONEY} }
              compareAtPrice { ${MONEY} }
              image { ${IMAGE} }
            }
          }
        }
      }
    }`,
    { handle }
  );
  return data.product;
}

/* ─── Cart ─────────────────────────────────────────────────── */

const CART = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { ${MONEY} } }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        cost { totalAmount { ${MONEY} } }
        merchandise {
          ... on ProductVariant {
            id
            title
            image { ${IMAGE} }
            product { title handle }
          }
        }
      }
    }
  }
`;

/** Cart mutations report problems (e.g. out of stock) as userErrors instead of throwing. */
function unwrapCart(result) {
  if (result.userErrors?.length) throw new ShopifyError(result.userErrors[0].message);
  return result.cart;
}

export async function getCart(cartId) {
  const data = await shopifyFetch(`query Cart($cartId: ID!) { cart(id: $cartId) { ${CART} } }`, { cartId });
  return data.cart; // null once the cart expires or is checked out
}

export async function createCart(lines) {
  const data = await shopifyFetch(
    `mutation CartCreate($lines: [CartLineInput!]) {
      cartCreate(input: { lines: $lines }) { cart { ${CART} } userErrors { message } }
    }`,
    { lines }
  );
  return unwrapCart(data.cartCreate);
}

export async function addCartLines(cartId, lines) {
  const data = await shopifyFetch(
    `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART} } userErrors { message } }
    }`,
    { cartId, lines }
  );
  return unwrapCart(data.cartLinesAdd);
}

export async function updateCartLines(cartId, lines) {
  const data = await shopifyFetch(
    `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART} } userErrors { message } }
    }`,
    { cartId, lines }
  );
  return unwrapCart(data.cartLinesUpdate);
}

export async function removeCartLines(cartId, lineIds) {
  const data = await shopifyFetch(
    `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART} } userErrors { message } }
    }`,
    { cartId, lineIds }
  );
  return unwrapCart(data.cartLinesRemove);
}
