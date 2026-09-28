// Product page: gallery, option pickers (size, color...), and add to cart.

import { getProduct } from "./api.js";
import { addToCart, initCart, openCart, toast } from "./cart.js";
import { el, formatMoney, productImage } from "./utils.js";

const root = document.getElementById("product");
const params = new URLSearchParams(location.search);
const handle = params.get("handle");

let product;
let variants = [];
let selected = {}; // option name -> chosen value
let activeImage;

/** The variant matching every selected option, or undefined if that combination doesn't exist. */
function findVariant(selection) {
  return variants.find((v) => v.selectedOptions.every((o) => selection[o.name] === o.value));
}

function currentVariant() {
  return findVariant(selected);
}

/** Pick a starting variant: the one in the URL, else the first one that's in stock. */
function initialVariant() {
  const fromUrl = variants.find((v) => v.id.endsWith(`/${params.get("variant")}`));
  return fromUrl ?? variants.find((v) => v.availableForSale) ?? variants[0];
}

function syncUrl(variant) {
  const next = new URLSearchParams({ handle });
  if (variants.length > 1 && variant) next.set("variant", variant.id.split("/").pop());
  history.replaceState(null, "", `${location.pathname}?${next}`);
}

/* ─── Render ───────────────────────────────────────────────── */

function renderGallery(images) {
  const main = root.querySelector(".gallery__main");
  main.replaceChildren(productImage(activeImage, { width: 900, alt: product.title, eager: true }));

  const thumbs = root.querySelector(".gallery__thumbs");
  thumbs.hidden = images.length < 2;
  thumbs.replaceChildren(
    ...images.map((image, i) =>
      el(
        "button",
        {
          type: "button",
          class: "gallery__thumb",
          "aria-label": `Show image ${i + 1} of ${images.length}`,
          "aria-pressed": String(image.url === activeImage?.url),
          onclick: () => {
            activeImage = image;
            renderGallery(images);
          },
        },
        productImage(image, { width: 160, alt: "" })
      )
    )
  );
}

function renderOptions() {
  const container = root.querySelector(".options");
  const options = product.options.filter((o) => !(o.optionValues.length === 1 && o.optionValues[0].name === "Default Title"));

  container.replaceChildren(
    ...options.map((option) =>
      el(
        "fieldset",
        { class: "option" },
        el("legend", {}, option.name, el("span", { class: "option__value" }, selected[option.name])),
        el(
          "div",
          { class: "option__values" },
          option.optionValues.map(({ name: value }) => {
            // Grey out values that are sold out given the other current choices
            const match = findVariant({ ...selected, [option.name]: value });
            const available = Boolean(match?.availableForSale);
            const id = `opt-${option.name}-${value}`.replace(/\W+/g, "-");
            return el(
              "label",
              { class: `pill ${available ? "" : "pill--unavailable"}`, for: id },
              el("input", {
                type: "radio",
                id,
                name: option.name,
                value,
                checked: selected[option.name] === value,
                onchange: () => selectOption(option.name, value),
              }),
              el("span", {}, value),
              !available && el("span", { class: "visually-hidden" }, " (sold out)")
            );
          })
        )
      )
    )
  );
}

function renderPurchase() {
  const variant = currentVariant();
  const priceNode = root.querySelector(".product__price");
  const stock = root.querySelector(".product__stock");
  const button = root.querySelector("[data-add]");

  if (!variant) {
    priceNode.replaceChildren();
    stock.textContent = "This combination isn't available.";
    button.disabled = true;
    button.textContent = "Unavailable";
    return;
  }

  const onSale = Boolean(variant.compareAtPrice) && Number(variant.compareAtPrice.amount) > Number(variant.price.amount);
  // replaceChildren() would print "null"/"false" as text, so only pass real nodes
  priceNode.replaceChildren(
    ...[
      el("span", {}, formatMoney(variant.price)),
      onSale && el("s", { class: "price-compare" }, formatMoney(variant.compareAtPrice)),
      onSale && el("span", { class: "badge badge--sale" }, "Sale"),
    ].filter(Boolean)
  );

  stock.textContent = variant.availableForSale ? "In stock, ready to ship" : "Sold out";
  stock.classList.toggle("product__stock--out", !variant.availableForSale);
  button.disabled = !variant.availableForSale;
  button.textContent = variant.availableForSale ? "Add to cart" : "Sold out";
}

function selectOption(name, value) {
  selected = { ...selected, [name]: value };
  const variant = currentVariant();
  if (variant?.image) {
    activeImage = variant.image;
    renderGallery(images());
  }
  syncUrl(variant);
  renderOptions();
  renderPurchase();
}

/** Product photos plus any variant photo that isn't already in the list. */
function images() {
  const all = product.images.edges.map((e) => e.node);
  for (const variant of variants) {
    if (variant.image && !all.some((img) => img.url === variant.image.url)) all.push(variant.image);
  }
  return all;
}

function renderProduct() {
  document.title = `${product.title} — Driftwood Supply Co.`;
  root.querySelector(".breadcrumb__category").textContent = product.productType;
  root.querySelector(".breadcrumb__category").href = `index.html?category=${encodeURIComponent(product.productType)}#shop`;
  root.querySelector(".breadcrumb__current").textContent = product.title;
  root.querySelector(".product__type").textContent = product.productType;
  root.querySelector(".product__title").textContent = product.title;
  root.querySelector(".product__description").textContent = product.description;

  renderGallery(images());
  renderOptions();
  renderPurchase();
  root.classList.remove("product--loading");
}

function renderMessage(message) {
  root.replaceChildren(
    el(
      "div",
      { class: "empty" },
      el("p", {}, message),
      el("a", { href: "index.html#shop", class: "button button--secondary" }, "Back to the shop")
    )
  );
}

/* ─── Add to cart ─────────────────────────────────────────── */

const quantityInput = root.querySelector("#quantity");
root.querySelector("[data-qty-minus]").addEventListener("click", () => {
  quantityInput.value = String(Math.max(1, Number(quantityInput.value) - 1));
});
root.querySelector("[data-qty-plus]").addEventListener("click", () => {
  quantityInput.value = String(Math.min(99, Number(quantityInput.value) + 1));
});

root.querySelector(".purchase").addEventListener("submit", async (event) => {
  event.preventDefault();
  const variant = currentVariant();
  if (!variant?.availableForSale) return;

  const button = root.querySelector("[data-add]");
  button.disabled = true;
  button.textContent = "Adding…";
  try {
    await addToCart(variant.id, Math.max(1, Math.min(99, Number(quantityInput.value) || 1)));
    openCart();
  } catch (err) {
    toast(err.message, { error: true });
  } finally {
    renderPurchase();
  }
});

/* ─── Load ────────────────────────────────────────────────── */

async function load() {
  if (!handle) return renderMessage("No product selected.");
  try {
    product = await getProduct(handle);
  } catch (err) {
    return renderMessage(`Couldn't load this product. ${err.message}`);
  }
  if (!product) return renderMessage("We couldn't find that product.");

  variants = product.variants.edges.map((e) => e.node);
  const start = initialVariant();
  selected = Object.fromEntries(start.selectedOptions.map((o) => [o.name, o.value]));
  activeImage = start.image ?? product.featuredImage;
  renderProduct();
}

initCart();
load();
