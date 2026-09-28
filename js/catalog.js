// Home / catalog page: product grid with search, category filter, and sort.

import { getAllProducts } from "./api.js";
import { initCart } from "./cart.js";
import { el, formatMoney, productImage } from "./utils.js";

const SORTS = {
  featured: { label: "Featured", compare: () => 0 },
  "price-asc": { label: "Price: low to high", compare: (a, b) => price(a) - price(b) },
  "price-desc": { label: "Price: high to low", compare: (a, b) => price(b) - price(a) },
  newest: { label: "Newest", compare: (a, b) => b.createdAt.localeCompare(a.createdAt) },
  "title-asc": { label: "Name: A to Z", compare: (a, b) => a.title.localeCompare(b.title) },
};

const price = (p) => Number(p.priceRange.minVariantPrice.amount);

// Filters live in the URL so a filtered view can be shared or bookmarked.
const params = new URLSearchParams(location.search);
const state = {
  products: [],
  query: params.get("q") ?? "",
  category: params.get("category") ?? "all",
  sort: SORTS[params.get("sort")] ? params.get("sort") : "featured",
};

const grid = document.getElementById("product-grid");
const categoryList = document.getElementById("category-filter");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const resultCount = document.getElementById("result-count");

function syncUrl() {
  const next = new URLSearchParams();
  if (state.query) next.set("q", state.query);
  if (state.category !== "all") next.set("category", state.category);
  if (state.sort !== "featured") next.set("sort", state.sort);
  const qs = next.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
}

function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  return state.products
    .filter((p) => state.category === "all" || p.productType === state.category)
    .filter((p) => !q || p.title.toLowerCase().includes(q) || p.productType.toLowerCase().includes(q))
    .sort(SORTS[state.sort].compare);
}

function priceLabel(product) {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  const compare = product.compareAtPriceRange.maxVariantPrice;
  const onSale = Number(compare.amount) > Number(min.amount);

  return el(
    "p",
    { class: "card__price" },
    Number(max.amount) > Number(min.amount) ? `From ${formatMoney(min)}` : formatMoney(min),
    onSale && el("s", { class: "price-compare" }, formatMoney(compare))
  );
}

function productCard(product) {
  const onSale = Number(product.compareAtPriceRange.maxVariantPrice.amount) > price(product);
  const badge = !product.availableForSale ? "Sold out" : onSale ? "Sale" : null;

  return el(
    "li",
    {},
    el(
      "a",
      { class: "card", href: `product.html?handle=${encodeURIComponent(product.handle)}` },
      el(
        "div",
        { class: "card__media" },
        productImage(product.featuredImage, { width: 480, alt: product.title }),
        badge && el("span", { class: `badge ${badge === "Sale" ? "badge--sale" : ""}` }, badge)
      ),
      el("p", { class: "card__type" }, product.productType),
      el("h3", { class: "card__title" }, product.title),
      priceLabel(product)
    )
  );
}

function renderCategories() {
  const counts = new Map();
  for (const p of state.products) counts.set(p.productType, (counts.get(p.productType) ?? 0) + 1);
  const categories = [["all", state.products.length], ...[...counts].sort((a, b) => a[0].localeCompare(b[0]))];

  categoryList.replaceChildren(
    ...categories.map(([name, count]) =>
      el(
        "button",
        {
          type: "button",
          class: "chip",
          "aria-pressed": String(state.category === name),
          onclick: () => {
            state.category = name;
            render();
          },
        },
        name === "all" ? "All" : name,
        el("span", { class: "chip__count" }, String(count))
      )
    )
  );
}

function render() {
  syncUrl();
  renderCategories();
  const products = visibleProducts();
  resultCount.textContent = `${products.length} ${products.length === 1 ? "product" : "products"}`;

  if (products.length === 0) {
    grid.replaceChildren(
      el(
        "li",
        { class: "empty" },
        el("p", {}, state.products.length ? "No products match your search." : "No products yet — check back soon."),
        state.products.length > 0 &&
          el(
            "button",
            {
              type: "button",
              class: "button button--secondary",
              onclick: () => {
                state.query = "";
                state.category = "all";
                searchInput.value = "";
                render();
              },
            },
            "Clear filters"
          )
      )
    );
    return;
  }
  grid.replaceChildren(...products.map(productCard));
}

function renderSkeletons() {
  grid.replaceChildren(
    ...Array.from({ length: 8 }, () =>
      el("li", { "aria-hidden": "true" }, el("div", { class: "card card--skeleton" }, el("div", { class: "card__media" }), el("span"), el("span")))
    )
  );
}

async function load() {
  renderSkeletons();
  try {
    state.products = await getAllProducts();
    render();
  } catch (err) {
    grid.replaceChildren(
      el(
        "li",
        { class: "empty" },
        el("p", {}, `Couldn't load products. ${err.message}`),
        el("button", { type: "button", class: "button button--secondary", onclick: load }, "Try again")
      )
    );
  }
}

// Controls
searchInput.value = state.query;
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = searchInput.value;
    render();
  }, 150);
});

sortSelect.replaceChildren(...Object.entries(SORTS).map(([value, { label }]) => el("option", { value }, label)));
sortSelect.value = state.sort;
sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

initCart();
load();
