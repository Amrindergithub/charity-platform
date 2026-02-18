import { useState, useEffect } from "react";
import { apiFetch } from "../utils/ethereum";
import styles from "./MarketData.module.css";

const REFRESH_INTERVAL = 60000; // 60 seconds

export default function MarketData() {
  const [ethPrice, setEthPrice] = useState(null);
  const [cryptoAssets, setCryptoAssets] = useState(null);
  const [btcPrice, setBtcPrice] = useState(null);
  const [cryptoPrices, setCryptoPrices] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [countries, setCountries] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState({});

  const loadAll = async () => {
    const errs = {};

    const fetchers = [
      { key: "ethPrice", endpoint: "/api/eth-price", setter: setEthPrice },
      { key: "cryptoAssets", endpoint: "/api/crypto-assets", setter: setCryptoAssets },
      { key: "btcPrice", endpoint: "/api/btc-price", setter: setBtcPrice },
      { key: "cryptoPrices", endpoint: "/api/crypto-prices", setter: setCryptoPrices },
      { key: "exchangeRates", endpoint: "/api/exchange-rates", setter: setExchangeRates },
      { key: "countries", endpoint: "/api/countries", setter: setCountries },
      { key: "geoData", endpoint: "/api/geolocate", setter: setGeoData },
    ];

    await Promise.allSettled(
      fetchers.map(async ({ key, endpoint, setter }) => {
        try {
          const data = await apiFetch(endpoint);
          setter(data);
        } catch (e) {
          errs[key] = e.message;
        }
      })
    );

    setErrors(errs);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      if (!document.hidden) loadAll();
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const fmt = (n, decimals = 2) => {
    if (n == null) return "N/A";
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const pctArrow = (val) => {
    if (val == null) return "";
    return val >= 0 ? "+" : "";
  };

  const isUp = (val) => val != null && val >= 0;

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.displayTitle}>Market Data</h1>
          <p className={styles.headerDesc}>Loading live data from 7 public APIs...</p>
        </div>
        <div className={styles.skelGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={styles.skelPanel}>
              <div className={styles.skelLine} style={{ width: "60%" }} />
              <div className={styles.skelLine} style={{ width: "80%" }} />
              <div className={styles.skelLineShort} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const apiSources = [
    { name: "CoinGecko", bg: "rgba(141,198,71,0.08)", color: "#8dc647", border: "rgba(141,198,71,0.2)" },
    { name: "Coinpaprika", bg: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "rgba(59,130,246,0.2)" },
    { name: "Blockchain.info", bg: "rgba(247,147,26,0.08)", color: "#f7931a", border: "rgba(247,147,26,0.2)" },
    { name: "CryptoCompare", bg: "rgba(123,63,228,0.08)", color: "#7b3fe4", border: "rgba(123,63,228,0.2)" },
    { name: "Frankfurter", bg: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    { name: "REST Countries", bg: "rgba(16,185,129,0.08)", color: "#10b981", border: "rgba(16,185,129,0.2)" },
    { name: "ip-api.com", bg: "rgba(6,182,212,0.08)", color: "#06b6d4", border: "rgba(6,182,212,0.2)" },
  ];

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.displayTitle}>Market Data</h1>
        <p className={styles.headerDesc}>
          Live data from 7 public APIs integrated via the{" "}
          <a href="https://github.com/Amrindergithub/public-apis" target="_blank" rel="noreferrer" className={styles.headerDescLink}>
            public-apis
          </a>{" "}
          repository. Auto-refreshes every 60 seconds.
        </p>

        {/* Status Bar */}
        <div className={styles.statusBar}>
          <div className={styles.syncBadge}>
            <span className={styles.pulseDot} />
            Synchronized
          </div>
          {lastUpdated && (
            <>
              <span className={styles.lastUpdated}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <button onClick={loadAll} className={styles.refreshBtn}>
                Refresh Now
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── API Source Badges ── */}
      <div className={styles.apiBadges}>
        {apiSources.map(api => (
          <span
            key={api.name}
            className={styles.apiBadge}
            style={{ background: api.bg, color: api.color, border: `1px solid ${api.border}` }}
          >
            {api.name}
          </span>
        ))}
      </div>

      {/* ── ETH / BTC Price Cards ── */}
      <div className={styles.priceRow}>
        {/* ETH Price */}
        <div className={styles.priceCard}>
          <div className={styles.priceCardHeader}>
            <div className={styles.assetIdent}>
              <div className={styles.assetIcon}>E</div>
              <div>
                <div className={styles.assetName}>Ethereum</div>
                <div className={styles.assetPair}>ETH/USD</div>
              </div>
            </div>
            <span className={styles.sourceBadge} style={{ background: "rgba(141,198,71,0.1)", color: "#8dc647", border: "1px solid rgba(141,198,71,0.2)" }}>
              CoinGecko
            </span>
          </div>
          {errors.ethPrice ? (
            <div className={styles.errorText}>Failed to load</div>
          ) : ethPrice ? (
            <>
              <div className={styles.priceValue}>${fmt(ethPrice.usd)}</div>
              {ethPrice.usd_24h_change != null && (
                <div className={`${styles.priceChange} ${isUp(ethPrice.usd_24h_change) ? styles.changeUp : styles.changeDown}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: "1rem" }}>
                    {isUp(ethPrice.usd_24h_change) ? "trending_up" : "trending_down"}
                  </span>
                  {pctArrow(ethPrice.usd_24h_change)}{fmt(ethPrice.usd_24h_change)}% (24h)
                </div>
              )}
              <div className={styles.fiatRow}>
                <span className={styles.fiatItem}>
                  GBP: <strong className={styles.fiatItemValue}>{"\u00A3"}{fmt(ethPrice.gbp)}</strong>
                </span>
                <span className={styles.fiatItem}>
                  EUR: <strong className={styles.fiatItemValue}>{"\u20AC"}{fmt(ethPrice.eur)}</strong>
                </span>
              </div>
              {/* SVG Sparkline */}
              <svg className={styles.sparkline} viewBox="0 0 200 40" preserveAspectRatio="none" width="100%">
                <defs>
                  <linearGradient id="sparkGradEth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5C00" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#FF5C00" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,30 Q25,28 50,22 T100,18 T150,12 T200,8" fill="none" stroke="#FF5C00" strokeWidth="1.5" />
                <path d="M0,30 Q25,28 50,22 T100,18 T150,12 T200,8 V40 H0 Z" fill="url(#sparkGradEth)" />
              </svg>
            </>
          ) : null}
        </div>

        {/* BTC Price */}
        <div className={styles.priceCard}>
          <div className={styles.priceCardHeader}>
            <div className={styles.assetIdent}>
              <div className={styles.assetIcon}>B</div>
              <div>
                <div className={styles.assetName}>Bitcoin</div>
                <div className={styles.assetPair}>BTC/USD</div>
              </div>
            </div>
            <span className={styles.sourceBadge} style={{ background: "rgba(247,147,26,0.1)", color: "#f7931a", border: "1px solid rgba(247,147,26,0.2)" }}>
              Blockchain.info
            </span>
          </div>
          {errors.btcPrice ? (
            <div className={styles.errorText}>Failed to load</div>
          ) : btcPrice ? (
            <>
              <div className={styles.priceValue}>${fmt(btcPrice.usd)}</div>
              <div className={styles.fiatRow}>
                <span className={styles.fiatItem}>
                  GBP: <strong className={styles.fiatItemValue}>{"\u00A3"}{fmt(btcPrice.gbp)}</strong>
                </span>
                <span className={styles.fiatItem}>
                  EUR: <strong className={styles.fiatItemValue}>{"\u20AC"}{fmt(btcPrice.eur)}</strong>
                </span>
              </div>
              <svg className={styles.sparkline} viewBox="0 0 200 40" preserveAspectRatio="none" width="100%">
                <defs>
                  <linearGradient id="sparkGradBtc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB955" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#FFB955" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,25 Q30,30 60,20 T120,15 T180,22 T200,10" fill="none" stroke="#FFB955" strokeWidth="1.5" />
                <path d="M0,25 Q30,30 60,20 T120,15 T180,22 T200,10 V40 H0 Z" fill="url(#sparkGradBtc)" />
              </svg>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Asset Ledger (Coinpaprika) ── */}
      <div className={styles.ledgerPanel}>
        <div className={styles.ledgerHeader}>
          <h3 className={styles.ledgerTitle}>Asset Ledger</h3>
          <span className={styles.ledgerSourceBadge} style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
            Coinpaprika
          </span>
        </div>
        {errors.cryptoAssets ? (
          <div style={{ padding: "20px 24px" }} className={styles.errorText}>Failed to load</div>
        ) : cryptoAssets ? (
          <table className={styles.ledgerTable}>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Price</th>
                <th>24h Change</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {cryptoAssets.map((coin, i) => (
                <tr key={coin.id || i}>
                  <td>
                    <div className={styles.assetCell}>
                      <div className={styles.assetCellIcon}>{coin.symbol?.charAt(0)}</div>
                      <div>
                        <div className={styles.assetCellName}>{coin.symbol}</div>
                        <div className={styles.assetCellSub}>{coin.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.tdBold}>${fmt(coin.priceUsd)}</td>
                  <td>
                    {coin.changePercent24h != null ? (
                      <span className={isUp(parseFloat(coin.changePercent24h)) ? styles.changeUp : styles.changeDown} style={{ fontWeight: 700 }}>
                        {pctArrow(parseFloat(coin.changePercent24h))}{fmt(parseFloat(coin.changePercent24h))}%
                      </span>
                    ) : "N/A"}
                  </td>
                  <td>{coin.volume24h ? `$${fmt(coin.volume24h, 0)}` : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* ── Multi-Currency Matrix (CryptoCompare) ── */}
      <div className={styles.matrixPanel}>
        <div className={styles.matrixHeader}>
          <h3 className={styles.matrixTitle}>Multi-Currency Price Matrix</h3>
          <span className={styles.ledgerSourceBadge} style={{ background: "rgba(123,63,228,0.1)", color: "#7b3fe4", border: "1px solid rgba(123,63,228,0.2)" }}>
            CryptoCompare
          </span>
        </div>
        {errors.cryptoPrices ? (
          <div style={{ padding: "20px 24px" }} className={styles.errorText}>Failed to load</div>
        ) : cryptoPrices ? (
          <div style={{ overflowX: "auto" }}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>Coin</th>
                  {Object.keys(Object.values(cryptoPrices)[0] || {}).map(fiat => (
                    <th key={fiat}>{fiat}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(cryptoPrices).map(([coin, fiats]) => (
                  <tr key={coin}>
                    <td>{coin}</td>
                    {Object.entries(fiats).map(([fiat, price]) => (
                      <td key={fiat}>
                        {fiat === "USD" ? "$" : fiat === "GBP" ? "\u00A3" : fiat === "EUR" ? "\u20AC" : ""}{fmt(price)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Exchange Rates + Geolocation ── */}
      <div className={styles.twoCol}>

        {/* Fiat Exchange Rates */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Fiat Exchange Rates</h3>
            <span className={styles.ledgerSourceBadge} style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
              Frankfurter
            </span>
          </div>
          {errors.exchangeRates ? (
            <div className={styles.errorText}>Failed to load</div>
          ) : exchangeRates?.rates ? (
            <>
              <div className={styles.fiatBase}>
                Base: <strong>{exchangeRates.base || "EUR"}</strong> &mdash; {exchangeRates.date}
              </div>
              <div className={styles.fiatGrid}>
                {Object.entries(exchangeRates.rates).slice(0, 15).map(([currency, rate]) => (
                  <div key={currency} className={styles.fiatCell}>
                    <span className={styles.fiatCellCode}>{currency}</span>
                    <span className={styles.fiatCellRate}>{fmt(rate, 4)}</span>
                  </div>
                ))}
              </div>
              {Object.keys(exchangeRates.rates).length > 15 && (
                <div className={styles.fiatMore}>
                  + {Object.keys(exchangeRates.rates).length - 15} more currencies
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Geolocation */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Your Location</h3>
            <span className={styles.ledgerSourceBadge} style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
              ip-api.com
            </span>
          </div>
          {errors.geoData ? (
            <div className={styles.errorText}>Failed to load (may be blocked on localhost)</div>
          ) : geoData ? (
            <div>
              {[
                { label: "Country", value: `${geoData.country} (${geoData.countryCode})` },
                { label: "Region", value: geoData.regionName || geoData.region },
                { label: "City", value: geoData.city },
                { label: "ISP", value: geoData.isp },
                { label: "Timezone", value: geoData.timezone },
                { label: "Coordinates", value: geoData.lat && geoData.lon ? `${geoData.lat}, ${geoData.lon}` : "N/A" },
              ].filter(r => r.value).map((row, i) => (
                <div key={i} className={styles.geoRow}>
                  <span className={styles.geoLabel}>{row.label}</span>
                  <span className={styles.geoValue}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Countries Database ── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Countries Database</h3>
          <span className={styles.ledgerSourceBadge} style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
            REST Countries
          </span>
        </div>
        {errors.countries ? (
          <div className={styles.errorText}>Failed to load</div>
        ) : countries ? (
          <>
            <div className={styles.countriesCount}>
              {countries.length} countries loaded -- used for donor registration and campaign geographic targeting
            </div>
            <div className={styles.countriesWrap}>
              {countries
                .sort((a, b) => (a.name?.common || "").localeCompare(b.name?.common || ""))
                .slice(0, 60)
                .map((c, i) => (
                  <span key={i} className={styles.countryTag}>
                    {c.flags?.png && <img src={c.flags.png} alt="" className={styles.countryFlag} />}
                    {c.name?.common || c.cca2}
                  </span>
                ))}
              {countries.length > 60 && (
                <span className={styles.countriesMore}>
                  + {countries.length - 60} more
                </span>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* ── API Integration Info ── */}
      <div className={styles.apiInfoPanel}>
        <h3 className={styles.apiInfoTitle}>Public API Integration</h3>
        <p className={styles.apiInfoDesc}>
          TrustChain integrates <strong>7 free public APIs</strong> from the{" "}
          <a href="https://github.com/Amrindergithub/public-apis" target="_blank" rel="noreferrer" className={styles.headerDescLink}>
            public-apis
          </a>{" "}
          repository to provide real-time market context for charity donations. All data is proxied through
          the backend with caching to minimise external API calls and protect client IP addresses.
        </p>
        <div className={styles.apiInfoGrid}>
          {[
            { api: "CoinGecko", endpoint: "/api/eth-price", desc: "ETH price in USD/GBP/EUR + 24h change", cache: "60s" },
            { api: "Coinpaprika", endpoint: "/api/crypto-assets", desc: "ETH, BTC, USDT prices + market cap", cache: "60s" },
            { api: "Blockchain.info", endpoint: "/api/btc-price", desc: "BTC ticker in multiple fiat currencies", cache: "none" },
            { api: "CryptoCompare", endpoint: "/api/crypto-prices", desc: "Multi-crypto multi-fiat price matrix", cache: "none" },
            { api: "Frankfurter", endpoint: "/api/exchange-rates", desc: "ECB fiat exchange rates (30+ currencies)", cache: "5min" },
            { api: "REST Countries", endpoint: "/api/countries", desc: "250 countries with names, flags, codes", cache: "none" },
            { api: "ip-api.com", endpoint: "/api/geolocate", desc: "Visitor geolocation (country, city, ISP)", cache: "none" },
          ].map((item, i) => (
            <div key={i} className={styles.apiInfoItem}>
              <div style={{ flex: 1 }}>
                <div className={styles.apiInfoName}>{item.api}</div>
                <div className={styles.apiInfoItemDesc}>{item.desc}</div>
                <code className={styles.apiInfoEndpoint}>GET {item.endpoint}</code>
              </div>
              {item.cache !== "none" && (
                <span className={styles.apiInfoCache}>Cache: {item.cache}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
