import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, imageUrl } from "../js/utils.js";

test("formatMoney formats Shopify money objects", () => {
  assert.equal(formatMoney({ amount: "19.0", currencyCode: "USD" }), "$19.00");
  assert.equal(formatMoney({ amount: "1249.5", currencyCode: "USD" }), "$1,249.50");
});

test("imageUrl asks Shopify's CDN for a resized image", () => {
  const url = imageUrl({ url: "https://cdn.shopify.com/s/files/photo.jpg?v=123" }, 480);
  assert.equal(new URL(url).searchParams.get("width"), "480");
  assert.equal(new URL(url).searchParams.get("v"), "123");
});
