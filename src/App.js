import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { scoreProduct } from './scoring';

const formatPrice = (priceText) => {
  if (!priceText) return 'Not found';
  return priceText.length > 16 ? `${priceText.slice(0, 16)}…` : priceText;
};

function App() {
  const [status, setStatus] = useState('Idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const scanPage = useCallback(() => {
    setStatus('Scanning…');
    setError('');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        setStatus('Idle');
        setError('No active tab found.');
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PRODUCT' }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus('Idle');
          setError('This page is not a Shopify product page.');
          return;
        }

        if (!response || !response.ok) {
          setStatus('Idle');
          setError('Unable to read product data.');
          return;
        }

        if (!response.data.isProductPage) {
          setStatus('Idle');
          setError('Open a Shopify product page to scan.');
          return;
        }

        const scored = scoreProduct(response.data);
        setResult({ ...response.data, ...scored });
        setStatus('Done');
      });
    });
  }, []);

  useEffect(() => {
    scanPage();
  }, [scanPage]);

  return (
    <div className="popup">
      <header className="popup__header">
        <h1>Guardify</h1>
        <p>Quick signals for potentially low-quality listings.</p>
      </header>

      <button className="primary" onClick={scanPage}>
        Re-check page
      </button>

      <section className="status">
        <span>Status</span>
        <strong>{status}</strong>
      </section>

      {error && <div className="error">{error}</div>}

      {result && (
        <section className="result">
          <div className={`risk risk--${result.risk.toLowerCase()}`}>
            <div className="risk__score">{result.score}</div>
            <div>
              <div className="risk__label">{result.risk} Risk</div>
              <div className="risk__sub">Heuristic score</div>
            </div>
          </div>

          <div className="result__row">
            <span>Title</span>
            <strong>{result.title || 'Not found'}</strong>
          </div>
          <div className="result__row">
            <span>Price</span>
            <strong>{formatPrice(result.priceText)}</strong>
          </div>
          <div className="result__row">
            <span>Images</span>
            <strong>{result.imageCount}</strong>
          </div>
          <div className="result__row">
            <span>Reviews</span>
            <strong>{result.reviewCount}</strong>
          </div>

          <div className="flags">
            <div className="flags__title">Signals</div>
            {result.flags.length === 0 ? (
              <div className="flags__item">No major signals detected.</div>
            ) : (
              result.flags.map((flag) => (
                <div className="flags__item" key={flag}>
                  {flag}
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
