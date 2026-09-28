// Cart state + the slide-out cart drawer.
//
// The cart lives on Shopify (Cart API). The browser only remembers the cart's
// id in localStorage, so the same cart comes back after a reload and checkout
// always reflects Shopify's real prices and stock.

import * as api from "./api.js";
import { el, formatMoney, productImage, storageGet, storageSet } from "./utils.js";

const CART_KEY = "driftwood:cartId";

let cart = null;
let busy = false;
const listeners = new Set();

export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setCart(next) {
  cart = next;
  storageSet(CART_KEY, next?.id ?? null);
  listeners.forEach((fn) => fn(cart));
}

export async function loadCart() {
  const id = storageGet(CART_KEY);
  if (!id) return setCart(null);
  try {
    setCart(await api.getCart(id)); // null if the cart expired or was checked out
  } catch {
    setCart(null);
  }
}

export async function addToCart(variantId, quantity = 1) {
  const lines = [{ merchandiseId: variantId, quantity }];
  try {
    setCart(cart ? await api.addCartLines(cart.id, lines) : await api.createCart(lines));
  } catch (err) {
    // The saved cart may have expired on Shopify's side; start a fresh one.
    if (!cart) throw err;
    setCart(await api.createCart(lines));
  }
}

async function setLineQuantity(lineId, quantity) {
  setCart(
    quantity > 0
      ? await api.updateCartLines(cart.id, [{ id: lineId, quantity }])
      : await api.removeCartLines(cart.id, [lineId])
  );
}

/* ─── Toast (small status message) ─────────────────────────── */

let toastTimer;
export function toast(message, { error = false } = {}) {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("toast--error", error);
  node.classList.add("toast--visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("toast--visible"), 3500);
}

/* ─── Drawer UI ────────────────────────────────────────────── */

const drawer = () => document.getElementById("cart-drawer");
let lastFocus = null;

export function openCart() {
  const node = drawer();
  lastFocus = document.activeElement;
  node.hidden = false;
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => node.classList.add("drawer--open"));
  node.querySelector(".drawer__close").focus();
}

export function closeCart() {
  const node = drawer();
  node.classList.remove("drawer--open");
  document.body.classList.remove("no-scroll");
  setTimeout(() => (node.hidden = true), 250);
  lastFocus?.focus();
}

async function withBusy(fn) {
  if (busy) return;
  busy = true;
  drawer().classList.add("drawer--busy");
  try {
    await fn();
  } catch (err) {
    toast(err.message, { error: true });
  } finally {
    busy = false;
    drawer().classList.remove("drawer--busy");
  }
}

function renderLine(line) {
  const { merchandise: variant, quantity } = line;
  const productUrl = `product.html?handle=${encodeURIComponent(variant.product.handle)}`;
  const options = variant.title === "Default Title" ? null : variant.title;

  return el(
    "li",
    { class: "cart-line" },
    el("a", { href: productUrl, class: "cart-line__image", tabindex: "-1" }, productImage(variant.image, { width: 160, alt: variant.product.title })),
    el(
      "div",
      { class: "cart-line__info" },
      el("a", { href: productUrl, class: "cart-line__title" }, variant.product.title),
      options && el("p", { class: "cart-line__options" }, options),
      el(
        "div",
        { class: "cart-line__controls" },
        el(
          "div",
          { class: "stepper", role: "group", "aria-label": `Quantity for ${variant.product.title}` },
          el("button", { type: "button", "aria-label": "Decrease quantity", onclick: () => withBusy(() => setLineQuantity(line.id, quantity - 1)) }, "−"),
          el("span", { "aria-live": "polite" }, String(quantity)),
          el("button", { type: "button", "aria-label": "Increase quantity", onclick: () => withBusy(() => setLineQuantity(line.id, quantity + 1)) }, "+")
        ),
        el("button", { type: "button", class: "link-button", onclick: () => withBusy(() => setLineQuantity(line.id, 0)) }, "Remove")
      )
    ),
    el("p", { class: "cart-line__price" }, formatMoney(line.cost.totalAmount))
  );
}

function renderDrawer(current) {
  const body = drawer().querySelector(".drawer__body");
  const footer = drawer().querySelector(".drawer__footer");
  const lines = current?.lines.edges.map((e) => e.node) ?? [];

  if (lines.length === 0) {
    body.replaceChildren(
      el(
        "div",
        { class: "drawer__empty" },
        el("p", {}, "Your cart is empty."),
        el("a", { href: "index.html#shop", class: "button button--secondary", onclick: closeCart }, "Continue shopping")
      )
    );
    footer.hidden = true;
    return;
  }

  body.replaceChildren(el("ul", { class: "cart-lines" }, lines.map(renderLine)));
  footer.hidden = false;
  footer.querySelector("[data-subtotal]").textContent = formatMoney(current.cost.subtotalAmount);
  footer.querySelector("[data-checkout]").href = current.checkoutUrl;
}

function renderCount(current) {
  const count = current?.totalQuantity ?? 0;
  for (const badge of document.querySelectorAll("[data-cart-count]")) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
  const button = document.getElementById("cart-button");
  if (button) button.setAttribute("aria-label", `Cart, ${count} ${count === 1 ? "item" : "items"}`);
}

/** Wire up the header cart button and drawer. Call once per page. */
export function initCart() {
  onCartChange(renderDrawer);
  onCartChange(renderCount);

  document.getElementById("cart-button").addEventListener("click", openCart);
  drawer().querySelector(".drawer__close").addEventListener("click", closeCart);
  drawer().querySelector(".drawer__overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !drawer().hidden) closeCart();
  });

  loadCart();
}
