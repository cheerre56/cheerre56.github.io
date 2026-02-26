(function initNahaCatalog(global) {
  const products = {
    "autumn-brew": {
      id: "autumn-brew",
      title: "Autumn Brew",
      chapter: "luminescence",
      image: "assets/media/images/perfume-placeholder.svg",
      variants: [
        { volumeMl: 10, price: 259 },
        { volumeMl: 30, price: 495 },
        { volumeMl: 50, price: 765 }
      ]
    },
    "forest-whispers": {
      id: "forest-whispers",
      title: "Forest Whispers",
      chapter: "luminescence",
      image: "assets/media/images/perfume-placeholder.svg",
      variants: [
        { volumeMl: 10, price: 259 },
        { volumeMl: 30, price: 495 },
        { volumeMl: 50, price: 765 }
      ]
    },
    "golden-nectar": {
      id: "golden-nectar",
      title: "Golden Nectar",
      chapter: "obsidian",
      image: "assets/media/images/perfume-placeholder.svg",
      variants: [
        { volumeMl: 10, price: 259 },
        { volumeMl: 30, price: 495 },
        { volumeMl: 50, price: 765 }
      ]
    },
    "ambre-sultan": {
      id: "ambre-sultan",
      title: "Ambre Sultan",
      chapter: "silhouette",
      image: "assets/media/images/perfume-placeholder.svg",
      variants: [
        { volumeMl: 10, price: 489 },
        { volumeMl: 30, price: 769 },
        { volumeMl: 50, price: 1059 }
      ]
    }
  };

  const legacyTitleMap = {
    "Autumn Brew": "autumn-brew",
    "Forest Whispers": "forest-whispers",
    "Golden Nectar": "golden-nectar",
    "Ambre Sultan": "ambre-sultan"
  };

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function getVariantKey(productId, volumeMl) {
    return `${productId}__${volumeMl}ml`;
  }

  function getProduct(productId) {
    return products[productId] || null;
  }

  function getVariant(productId, volumeMl) {
    const product = getProduct(productId);
    if (!product) {
      return null;
    }

    return product.variants.find((variant) => Number(variant.volumeMl) === Number(volumeMl)) || null;
  }

  function getProductIdByLegacyTitle(title) {
    return legacyTitleMap[title] || null;
  }

  function parseLegacyKey(key) {
    if (typeof key !== "string" || key.length === 0) {
      return null;
    }

    const newPatternMatch = key.match(/^([a-z0-9-]+)__([0-9]+)ml$/i);
    if (newPatternMatch) {
      return {
        productId: newPatternMatch[1],
        volumeMl: Number(newPatternMatch[2]),
        source: "v2"
      };
    }

    const legacyPatternMatch = key.match(/^(.+)_([0-9]+)ml$/i);
    if (!legacyPatternMatch) {
      return null;
    }

    const legacyTitle = legacyPatternMatch[1];
    const volumeMl = Number(legacyPatternMatch[2]);
    const productId = getProductIdByLegacyTitle(legacyTitle);

    if (!productId) {
      return {
        productId: null,
        volumeMl,
        legacyTitle,
        source: "legacy-unknown"
      };
    }

    return {
      productId,
      volumeMl,
      legacyTitle,
      source: "legacy-known"
    };
  }

  const catalogApi = {
    products,
    legacyTitleMap,
    toNumber,
    getProduct,
    getVariant,
    getVariantKey,
    getProductIdByLegacyTitle,
    parseLegacyKey
  };

  global.NahaCatalog = Object.freeze(catalogApi);
})(window);

