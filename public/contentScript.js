(() => {
  const isProductPage = () => /\/products\//i.test(window.location.pathname);

  const getText = (selectorList) => {
    for (const selector of selectorList) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        return el.textContent.trim();
      }
    }
    return '';
  };

  const parseJsonLdProduct = () => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const json = JSON.parse(script.textContent);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (!item) continue;
          if (item['@type'] === 'Product') {
            const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            const price = offers && (offers.price || offers['price']);
            const images = item.image || item.images || [];
            return {
              title: item.name || '',
              description: item.description || '',
              price: price || '',
              images: Array.isArray(images) ? images : [images]
            };
          }
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  };

  const normalizePrice = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      if (Number.isInteger(value) && value > 999) {
        return (value / 100).toFixed(2);
      }
      return value.toString();
    }
    const text = String(value).trim();
    const cleaned = text.replace(/\s+/g, '');
    const normalizedComma = cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(',', '.')
      : cleaned;
    const match = normalizedComma.match(/\d+(?:\.\d{1,2})?/);
    if (!match) return '';
    const num = Number(match[0]);
    if (Number.isFinite(num)) {
      if (!text.includes('.') && num > 999) {
        return (num / 100).toFixed(2);
      }
      return num.toFixed(text.includes('.') ? 2 : 2);
    }
    return '';
  };

  const parseShopifyProductJson = () => {
    try {
      const analytics = window.ShopifyAnalytics;
      const product = analytics && analytics.meta && analytics.meta.product;
      if (product && Array.isArray(product.variants) && product.variants.length) {
        const variant = product.variants[0];
        const price = normalizePrice(variant.price || variant.price_in_cents);
        if (price) return price;
      }
    } catch (error) {
      // ignore
    }

    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      const id = (script.getAttribute('id') || '').toLowerCase();
      if (!id.includes('product') && !script.dataset.productJson) {
        continue;
      }
      try {
        const json = JSON.parse(script.textContent);
        const product = json.product || json;
        const variants = product.variants || [];
        if (variants.length) {
          const price = normalizePrice(variants[0].price || variants[0].price_in_cents);
          if (price) return price;
        }
      } catch (error) {
        continue;
      }
    }

    return '';
  };

  const normalizeSrc = (src) => {
    if (!src) return '';
    const trimmed = src.trim();
    if (!trimmed) return '';
    return trimmed.split('?')[0];
  };

  const getPriceText = (jsonLdPrice) => {
    if (jsonLdPrice) {
      const normalized = normalizePrice(jsonLdPrice);
      if (normalized) return normalized;
    }

    const shopifyPrice = parseShopifyProductJson();
    if (shopifyPrice) {
      return shopifyPrice;
    }

    const selectors = [
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[itemprop="price"]',
      '[itemprop="price"]',
      '[data-product-price]',
      '[data-price]',
      '[data-regular-price]',
      '[data-sale-price]',
      '[data-price-amount]',
      '[data-price-min]',
      '[data-price-max]',
      'form[action*="/cart/add"] [class*="price"] [class*="money"]',
      'form[action*="/cart/add"] [class*="price"]',
      '[class*="product"] [class*="price"] [class*="money"]',
      '[class*="price"] [class*="money"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if (el.getAttribute && el.getAttribute('content')) {
        const normalized = normalizePrice(el.getAttribute('content'));
        if (normalized) return normalized;
      }
      if (el.textContent) {
        const text = el.textContent.trim();
        const normalized = normalizePrice(text);
        if (normalized) return normalized;
      }
    }

    return '';
  };

  const getImageSignals = (jsonLdImages = []) => {
    const imageSelectors = [
      '[data-product-media] img',
      '[data-product-single-media-wrapper] img',
      '[class*="product"] img',
      '[data-product-media] img',
      'img[srcset]',
      'img'
    ];

    const seen = new Set();
    let count = 0;
    let lowResCount = 0;
    let totalPixels = 0;
    let sizeSamples = 0;

    jsonLdImages.forEach((src) => {
      const normalized = normalizeSrc(src);
      if (!normalized) return;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        count += 1;
      }
    });

    const isProductImage = (img) => {
      if (img.closest('[aria-hidden="true"]')) return false;
      const container = img.closest(
        '[data-product-media], [data-product-single-media-wrapper], [data-product-single-media-group], [class*="product"], main'
      );
      return Boolean(container);
    };

    for (const selector of imageSelectors) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((img) => {
        if (!isProductImage(img)) return;
        const src = img.currentSrc || img.getAttribute('src') || img.getAttribute('data-src');
        const normalized = normalizeSrc(src);
        if (!normalized) return;
        const srcLower = normalized.toLowerCase();
        if (
          srcLower.includes('sprite') ||
          srcLower.includes('icon') ||
          srcLower.includes('logo') ||
          srcLower.includes('avatar') ||
          srcLower.includes('placeholder') ||
          srcLower.includes('favicon') ||
          srcLower.includes('1x1')
        ) {
          return;
        }

        if (!seen.has(normalized)) {
          seen.add(normalized);
          count += 1;

          const width = img.naturalWidth || Number(img.getAttribute('width')) || 0;
          const height = img.naturalHeight || Number(img.getAttribute('height')) || 0;
          if (width > 0 && height > 0) {
            const pixels = width * height;
            totalPixels += pixels;
            sizeSamples += 1;
            if (width < 300 || height < 300 || pixels < 150000) {
              lowResCount += 1;
            }
          }
        }
      });

      if (count >= 12) break;
    }

    const averagePixels = sizeSamples > 0 ? Math.round(totalPixels / sizeSamples) : 0;

    return {
      imageCount: count,
      imageLowResCount: lowResCount,
      imageAveragePixels: averagePixels
    };
  };

  const getReviewCount = () => {
    const reviewSelectors = [
      '[data-reviews-count]',
      '[class*="review-count"]',
      '[class*="reviews-count"]',
      '[class*="reviews"] [class*="count"]'
    ];

    for (const selector of reviewSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = (el.textContent || '').replace(/[,\s]/g, '');
      const match = text.match(/\d+/);
      if (match) return Number(match[0]);
    }

    return 0;
  };

  const extractProductData = () => {
    if (!isProductPage()) {
      return { isProductPage: false, url: window.location.href };
    }

    const jsonLd = parseJsonLdProduct();

    const title =
      (jsonLd && jsonLd.title) ||
      getText(['h1', '[class*="product"] h1', '[data-product-title]']);
    const description =
      (jsonLd && jsonLd.description) ||
      getText([
      '[itemprop="description"]',
      '[class*="product__description"]',
      '[class*="product-description"]',
      'meta[name="description"]'
    ]);

    const imageSignals = getImageSignals((jsonLd && jsonLd.images) || []);

    return {
      isProductPage: true,
      url: window.location.href,
      title,
      description,
      priceText: getPriceText(jsonLd && jsonLd.price),
      imageCount: imageSignals.imageCount,
      imageLowResCount: imageSignals.imageLowResCount,
      imageAveragePixels: imageSignals.imageAveragePixels,
      reviewCount: getReviewCount()
    };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'SCAN_PRODUCT') {
      const data = extractProductData();
      sendResponse({ ok: true, data });
    }
  });
})();
