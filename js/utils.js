// Small shared helpers.

export function formatMoney({ amount, currencyCode }) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(Number(amount));
}

/**
 * Build a DOM element without innerHTML, so text coming from the store is
 * always treated as text, never as HTML.
 *   el("p", { class: "price" }, "$20.00")
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

/** Ask Shopify's image CDN for a right-sized image instead of the full original. */
export function imageUrl(image, width) {
  const url = new URL(image.url);
  url.searchParams.set("width", String(width));
  return url.toString();
}

/** A product image, or a neutral placeholder when there's no image. */
export function productImage(image, { width, alt = "", className = "", eager = false }) {
  if (!image?.url) {
    return el("div", { class: `img-placeholder ${className}`, role: "img", "aria-label": alt || "No image" });
  }
  return el("img", {
    class: className,
    src: imageUrl(image, width),
    srcset: `${imageUrl(image, width)} 1x, ${imageUrl(image, width * 2)} 2x`,
    alt: image.altText || alt,
    loading: eager ? "eager" : "lazy",
    decoding: "async",
  });
}

export function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (private mode, etc.): the cart just won't persist
  }
}

export function storageSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
