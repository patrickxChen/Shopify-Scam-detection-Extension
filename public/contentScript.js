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

  const getPriceText = () => {
    const selectors = [
      '[itemprop="price"]',
      '[data-product-price]',
      '[class*="price"] [class*="money"]',
      '[class*="price"]',
      'meta[property="product:price:amount"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if (el.getAttribute && el.getAttribute('content')) {
        return el.getAttribute('content');
      }
      if (el.textContent) {
        const text = el.textContent.trim();
        if (text) return text;
      }
    }

    return '';
  };

  const getImageSignals = () => {
    const imageSelectors = [
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

    for (const selector of imageSelectors) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((img) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !seen.has(src)) {
          seen.add(src);
          count += 1;

          const width = img.naturalWidth || Number(img.getAttribute('width')) || 0;
          const height = img.naturalHeight || Number(img.getAttribute('height')) || 0;
          if (width > 0 && height > 0) {
            const pixels = width * height;
            totalPixels += pixels;
            sizeSamples += 1;
            if (width < 400 || height < 400 || pixels < 200000) {
              lowResCount += 1;
            }
          }
        }
      });

      if (count >= 6) break;
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

    const title = getText(['h1', '[class*="product"] h1', '[data-product-title]']);
    const description = getText([
      '[itemprop="description"]',
      '[class*="product__description"]',
      '[class*="product-description"]',
      'meta[name="description"]'
    ]);

    const imageSignals = getImageSignals();

    return {
      isProductPage: true,
      url: window.location.href,
      title,
      description,
      priceText: getPriceText(),
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
