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

  const getImagesCount = () => {
    const imageSelectors = [
      '[class*="product"] img',
      '[data-product-media] img',
      'img[srcset]',
      'img'
    ];

    const seen = new Set();
    let count = 0;

    for (const selector of imageSelectors) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((img) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !seen.has(src)) {
          seen.add(src);
          count += 1;
        }
      });

      if (count >= 6) break;
    }

    return count;
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

    return {
      isProductPage: true,
      url: window.location.href,
      title,
      description,
      priceText: getPriceText(),
      imageCount: getImagesCount(),
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
