const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { validateIP } = require('../middleware/validate');

// Rate limit proxy endpoints
const proxyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many API requests. Please wait.' }
});
router.use(proxyLimiter);

// ── Caches ──
let ethPriceCache = { price: null, timestamp: 0 };
const fxCache = {}; // keyed by base currency
let countriesCache = { data: null, timestamp: 0 };
let cryptoAssetsCache = { data: null, timestamp: 0 };

// ── CoinGecko — ETH Price (60s cache) ──
router.get('/eth-price', async (req, res) => {
    try {
        const now = Date.now();
        if (ethPriceCache.price && now - ethPriceCache.timestamp < 60000) {
            return res.json(ethPriceCache.price);
        }
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=gbp,usd,eur&include_24hr_change=true');
        if (!response.ok) throw new Error('CoinGecko API error');
        const data = await response.json();
        ethPriceCache = { price: data.ethereum, timestamp: now };
        res.json(data.ethereum);
    } catch (err) {
        if (ethPriceCache.price) return res.json(ethPriceCache.price);
        res.json({ gbp: 2150, usd: 2650, eur: 2450 });
    }
});

// ── REST Countries (24h cache) ──
router.get('/countries', async (req, res) => {
    try {
        const now = Date.now();
        if (countriesCache.data && now - countriesCache.timestamp < 86400000) {
            return res.json(countriesCache.data);
        }
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flags,cca2');
        if (!response.ok) throw new Error('REST Countries API error');
        const data = await response.json();
        const simplified = data.map(c => ({
            name: c.name.common,
            code: c.cca2,
            flag: c.flags?.svg || c.flags?.png || ''
        })).sort((a, b) => a.name.localeCompare(b.name));
        countriesCache = { data: simplified, timestamp: now };
        res.json(simplified);
    } catch (err) {
        if (countriesCache.data) return res.json(countriesCache.data);
        res.status(500).json({ error: 'Failed to fetch countries' });
    }
});

// ── Coinpaprika — Crypto Assets (60s cache) ──
router.get('/crypto-assets', async (req, res) => {
    try {
        const now = Date.now();
        if (cryptoAssetsCache.data && now - cryptoAssetsCache.timestamp < 60000) {
            return res.json(cryptoAssetsCache.data);
        }
        const coins = [
            { id: 'eth-ethereum', symbol: 'ETH', name: 'Ethereum' },
            { id: 'btc-bitcoin', symbol: 'BTC', name: 'Bitcoin' },
            { id: 'usdt-tether', symbol: 'USDT', name: 'Tether' },
        ];
        const results = await Promise.all(coins.map(async (c) => {
            const r = await fetch(`https://api.coinpaprika.com/v1/tickers/${c.id}`);
            const d = await r.json();
            return {
                id: c.id, symbol: c.symbol, name: c.name,
                priceUsd: parseFloat(d.quotes?.USD?.price || 0).toFixed(2),
                changePercent24h: parseFloat(d.quotes?.USD?.percent_change_24h || 0).toFixed(2),
                marketCapUsd: parseFloat(d.quotes?.USD?.market_cap || 0).toFixed(0),
            };
        }));
        cryptoAssetsCache = { data: results, timestamp: now };
        res.json(results);
    } catch (err) {
        if (cryptoAssetsCache.data) return res.json(cryptoAssetsCache.data);
        res.status(500).json({ error: 'Failed to fetch crypto assets' });
    }
});

// ── Frankfurter — Exchange Rates (5min cache, keyed by base) ──
router.get('/exchange-rates', async (req, res) => {
    try {
        const base = (req.query.base || 'USD').toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3);
        const now = Date.now();
        if (fxCache[base] && now - fxCache[base].timestamp < 300000) {
            return res.json(fxCache[base].data);
        }
        const response = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
        if (!response.ok) throw new Error('Frankfurter API error');
        const data = await response.json();
        fxCache[base] = { data, timestamp: now };
        res.json(data);
    } catch (err) {
        const base = (req.query.base || 'USD').toUpperCase().substring(0, 3);
        if (fxCache[base]) return res.json(fxCache[base].data);
        res.status(500).json({ error: 'Failed to fetch exchange rates' });
    }
});

// ── Blockchain.info — BTC Price ──
router.get('/btc-price', async (req, res) => {
    try {
        const response = await fetch('https://blockchain.info/ticker');
        if (!response.ok) throw new Error('Blockchain.info API error');
        const data = await response.json();
        res.json({
            gbp: data.GBP?.last || 0,
            usd: data.USD?.last || 0,
            eur: data.EUR?.last || 0,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch BTC price' });
    }
});

// ── ip-api.com — Geolocation (SSRF-safe) ──
router.get('/geolocate', async (req, res) => {
    try {
        const ip = req.query.ip || '';
        let url = 'http://ip-api.com/json/';
        if (ip) {
            if (!validateIP(ip)) {
                return res.status(400).json({ error: 'Invalid IP address format' });
            }
            url = `http://ip-api.com/json/${ip}`;
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error('ip-api error');
        const data = await response.json();
        res.json({
            country: data.country, countryCode: data.countryCode,
            region: data.regionName, city: data.city,
            lat: data.lat, lon: data.lon, isp: data.isp,
            timezone: data.timezone
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to geolocate' });
    }
});

// ── CryptoCompare — Multi-price matrix ──
router.get('/crypto-prices', async (req, res) => {
    try {
        const fsyms = (req.query.coins || 'ETH,BTC,USDT,USDC').replace(/[^A-Za-z,]/g, '').substring(0, 50);
        const tsyms = (req.query.currencies || 'GBP,USD,EUR').replace(/[^A-Za-z,]/g, '').substring(0, 30);
        const response = await fetch(`https://min-api.cryptocompare.com/data/pricemulti?fsyms=${fsyms}&tsyms=${tsyms}`);
        if (!response.ok) throw new Error('CryptoCompare API error');
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch crypto prices' });
    }
});

module.exports = router;
