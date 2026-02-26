(function initNahaCart(global) {
  const STORAGE_KEY = "nahaCart";

  function safeParse(jsonText) {
    if (typeof jsonText !== "string" || jsonText.trim().length === 0) {
      return null;
    }

    try {
      return JSON.parse(jsonText);
    } catch (error) {
      return null;
    }
  }

  function normalizeQuantity(rawValue) {
    const quantity = Number(rawValue);
    if (!Number.isFinite(quantity)) {
      return 0;
    }

    return Math.max(0, Math.floor(quantity));
  }

  function normalizeUnitPrice(rawValue) {
    const unitPrice = Number(rawValue);
    if (!Number.isFinite(unitPrice)) {
      return 0;
    }

    return Math.max(0, Math.floor(unitPrice));
  }

  function getCatalog() {
    return global.NahaCatalog || null;
  }

  function createEmptyCart() {
    return {
      version: 2,
      items: {}
    };
  }

  function isV2Cart(value) {
    return Boolean(value && typeof value === "object" && value.version === 2 && value.items && typeof value.items === "object");
  }

  function persistCart(cartState, shouldNotify = true) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartState));

    if (shouldNotify) {
      global.dispatchEvent(new CustomEvent("naha:cart-updated", { detail: { cart: cartState } }));
    }

    return cartState;
  }

  function buildLegacyFallbackProductId(legacyKey) {
    return `legacy-${legacyKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  }

  function inferQuantity(rawItem) {
    if (typeof rawItem === "number") {
      return normalizeQuantity(rawItem);
    }

    if (!rawItem || typeof rawItem !== "object") {
      return 0;
    }

    if (typeof rawItem.quantity !== "undefined") {
      return normalizeQuantity(rawItem.quantity);
    }

    return 0;
  }

  function inferVolumeMl(rawKey, rawItem, parsedKey) {
    if (rawItem && typeof rawItem === "object") {
      if (typeof rawItem.volumeMl !== "undefined") {
        const volumeFromField = Number(rawItem.volumeMl);
        if (Number.isFinite(volumeFromField) && volumeFromField > 0) {
          return Math.floor(volumeFromField);
        }
      }

      if (typeof rawItem.ml !== "undefined") {
        const volumeFromMl = Number(rawItem.ml);
        if (Number.isFinite(volumeFromMl) && volumeFromMl > 0) {
          return Math.floor(volumeFromMl);
        }
      }

      if (typeof rawItem.volume === "string") {
        const fromVolumeText = rawItem.volume.match(/([0-9]+)\s*ml/i);
        if (fromVolumeText) {
          return Number(fromVolumeText[1]);
        }
      }
    }

    if (parsedKey && Number.isFinite(parsedKey.volumeMl) && parsedKey.volumeMl > 0) {
      return Math.floor(parsedKey.volumeMl);
    }

    const fallbackMatch = typeof rawKey === "string" ? rawKey.match(/_([0-9]+)ml$/i) : null;
    if (fallbackMatch) {
      return Number(fallbackMatch[1]);
    }

    return 0;
  }

  function inferTitle(rawKey, rawItem, productId) {
    const catalog = getCatalog();
    const productFromCatalog = catalog && productId ? catalog.getProduct(productId) : null;
    if (productFromCatalog) {
      return productFromCatalog.title;
    }

    if (rawItem && typeof rawItem === "object" && typeof rawItem.titleSnapshot === "string" && rawItem.titleSnapshot.trim()) {
      return rawItem.titleSnapshot.trim();
    }

    if (rawItem && typeof rawItem === "object" && typeof rawItem.name === "string" && rawItem.name.trim()) {
      return rawItem.name.trim();
    }

    if (typeof rawKey === "string") {
      const legacyKeyParts = rawKey.split("_");
      if (legacyKeyParts.length > 1) {
        return legacyKeyParts.slice(0, legacyKeyParts.length - 1).join("_");
      }
      return rawKey;
    }

    return "Unknown Fragrance";
  }

  function inferUnitPrice(rawItem, productId, volumeMl) {
    const catalog = getCatalog();
    if (catalog && productId) {
      const variant = catalog.getVariant(productId, volumeMl);
      if (variant) {
        return normalizeUnitPrice(variant.price);
      }
    }

    if (rawItem && typeof rawItem === "object") {
      if (typeof rawItem.unitPriceSnapshot !== "undefined") {
        return normalizeUnitPrice(rawItem.unitPriceSnapshot);
      }

      if (typeof rawItem.price !== "undefined") {
        return normalizeUnitPrice(rawItem.price);
      }
    }

    return 0;
  }

  function normalizeLegacyEntry(rawKey, rawItem) {
    const catalog = getCatalog();
    const parsedKey = catalog ? catalog.parseLegacyKey(rawKey) : null;

    let productId = null;
    if (rawItem && typeof rawItem === "object" && typeof rawItem.productId === "string" && rawItem.productId.trim()) {
      productId = rawItem.productId.trim();
    } else if (parsedKey && parsedKey.productId) {
      productId = parsedKey.productId;
    }

    const volumeMl = inferVolumeMl(rawKey, rawItem, parsedKey);
    const quantity = inferQuantity(rawItem);
    const titleSnapshot = inferTitle(rawKey, rawItem, productId);
    const unitPriceSnapshot = inferUnitPrice(rawItem, productId, volumeMl);

    if (!productId) {
      productId = buildLegacyFallbackProductId(rawKey);
    }

    const variantKey = catalog && volumeMl > 0 ? catalog.getVariantKey(productId, volumeMl) : `${productId}__unknown`;

    return {
      variantKey,
      payload: {
        productId,
        volumeMl,
        quantity,
        unitPriceSnapshot,
        titleSnapshot
      }
    };
  }

  function migrateLegacyCart() {
    const rawFromStorage = safeParse(global.localStorage.getItem(STORAGE_KEY));

    if (isV2Cart(rawFromStorage)) {
      const normalizedItems = {};
      Object.entries(rawFromStorage.items).forEach(([variantKey, item]) => {
        if (!item || typeof item !== "object") {
          return;
        }

        const quantity = normalizeQuantity(item.quantity);
        if (quantity <= 0) {
          return;
        }

        normalizedItems[variantKey] = {
          productId: String(item.productId || "").trim() || buildLegacyFallbackProductId(variantKey),
          volumeMl: Number(item.volumeMl) > 0 ? Math.floor(Number(item.volumeMl)) : 0,
          quantity,
          unitPriceSnapshot: normalizeUnitPrice(item.unitPriceSnapshot),
          titleSnapshot: typeof item.titleSnapshot === "string" && item.titleSnapshot.trim() ? item.titleSnapshot.trim() : "Unknown Fragrance"
        };
      });

      const normalizedCart = { version: 2, items: normalizedItems };
      return persistCart(normalizedCart, false);
    }

    const migratedCart = createEmptyCart();

    if (!rawFromStorage || typeof rawFromStorage !== "object") {
      return persistCart(migratedCart, false);
    }

    Object.entries(rawFromStorage).forEach(([rawKey, rawItem]) => {
      const normalized = normalizeLegacyEntry(rawKey, rawItem);
      if (!normalized || normalized.payload.quantity <= 0) {
        return;
      }

      const existing = migratedCart.items[normalized.variantKey];
      if (existing) {
        existing.quantity += normalized.payload.quantity;
        if (!existing.unitPriceSnapshot && normalized.payload.unitPriceSnapshot) {
          existing.unitPriceSnapshot = normalized.payload.unitPriceSnapshot;
        }
        if ((!existing.titleSnapshot || existing.titleSnapshot === "Unknown Fragrance") && normalized.payload.titleSnapshot) {
          existing.titleSnapshot = normalized.payload.titleSnapshot;
        }
      } else {
        migratedCart.items[normalized.variantKey] = normalized.payload;
      }
    });

    return persistCart(migratedCart, false);
  }

  function getCart() {
    return migrateLegacyCart();
  }

  function addItem(productId, volumeMl, quantity = 1) {
    const catalog = getCatalog();
    const cartState = getCart();
    const normalizedQty = normalizeQuantity(quantity);

    if (!catalog || !catalog.getProduct(productId) || normalizedQty <= 0) {
      return cartState;
    }

    const parsedVolume = Number(volumeMl);
    const variant = catalog.getVariant(productId, parsedVolume);
    if (!variant) {
      return cartState;
    }

    const variantKey = catalog.getVariantKey(productId, variant.volumeMl);
    const existing = cartState.items[variantKey];

    if (existing) {
      existing.quantity += normalizedQty;
      existing.unitPriceSnapshot = normalizeUnitPrice(existing.unitPriceSnapshot || variant.price);
      existing.titleSnapshot = existing.titleSnapshot || catalog.getProduct(productId).title;
    } else {
      cartState.items[variantKey] = {
        productId,
        volumeMl: Number(variant.volumeMl),
        quantity: normalizedQty,
        unitPriceSnapshot: normalizeUnitPrice(variant.price),
        titleSnapshot: catalog.getProduct(productId).title
      };
    }

    return persistCart(cartState);
  }

  function updateItemQty(variantKey, quantity) {
    const cartState = getCart();
    const normalizedQty = normalizeQuantity(quantity);

    if (normalizedQty <= 0) {
      delete cartState.items[variantKey];
      return persistCart(cartState);
    }

    if (!cartState.items[variantKey]) {
      return cartState;
    }

    cartState.items[variantKey].quantity = normalizedQty;
    return persistCart(cartState);
  }

  function removeItem(variantKey) {
    const cartState = getCart();
    delete cartState.items[variantKey];
    return persistCart(cartState);
  }

  function getTotalCount() {
    const cartState = getCart();
    return Object.values(cartState.items).reduce((sum, item) => {
      return sum + normalizeQuantity(item.quantity);
    }, 0);
  }

  global.NahaCart = {
    getCart,
    addItem,
    updateItemQty,
    removeItem,
    getTotalCount,
    migrateLegacyCart
  };
})(window);
