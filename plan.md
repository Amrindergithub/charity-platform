# TrustChain — Full Professional Overhaul Plan

## Audit Found 80+ Issues Across 3 Layers. Here's the Fix Plan.

### Status: ALL 12 PHASES COMPLETED

---

## PHASE 1: Smart Contract Security Fixes (11 issues, single recompile) — COMPLETED

**File:** `contracts/CharityPlatform.sol`

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Reentrancy in `_executeRequest`** — `r.complete` set AFTER transfer | CRITICAL | Reorder: state changes BEFORE external calls (Checks-Effects-Interactions pattern). Replace `transfer()` with `call{value}()` |
| 2 | **Auto-release on cancelled campaigns** — votes still trigger fund release after cancellation | CRITICAL | Add `require(!c.cancelled)` to `approveRequest` |
| 3 | **Cross-campaign fund pool** — Campaign A's ETH pays Campaign B's requests | CRITICAL | Check `c.raisedAmount - c.totalDisbursed >= r.value` per-campaign, not `address(this).balance` |
| 4 | **Stablecoin min contribution bypass** — 1 wei stablecoin = full voting rights | HIGH | Add `require(_amount >= c.minimumContribution)` to `donateStablecoin` |
| 5 | **Donations to non-existent campaigns lock ETH** | HIGH | Add `require(_campaignId < campaignCount)` to both donate functions |
| 6 | **Refunds ignore already-disbursed funds** — can overdraw contract | CRITICAL | Calculate proportional refund: `(contribution × remaining) / totalRaised` |
| 7 | **Manager can vote on own requests** — undermines DAO governance | HIGH | Add `require(msg.sender != c.manager)` to `approveRequest` |
| 8 | **`finalizeRequest` works on cancelled campaigns** | HIGH | Add `require(!c.cancelled)` to `_executeRequest` |
| 9 | **No input validation** — empty name, zero target, zero-address recipient all accepted | MEDIUM | Add require checks in `createCampaign` and `createRequest` |
| 10 | **Stablecoin transfer return value unchecked** | MEDIUM | Use `require(token.transfer(...))` |
| 11 | **No event for `setStablecoinAddress`** | LOW | Add `StablecoinAddressUpdated` event |

→ Recompile + redeploy after all 11 fixes.

---

## PHASE 2: Backend Security Overhaul — COMPLETED

**File:** `backend/index.js` (modular routes in `backend/routes/`) | **New deps:** `bcrypt`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `multer`

| # | Issue | Fix |
|---|-------|-----|
| 12 | **Plaintext passwords** | bcrypt hash (12 salt rounds) on register, `bcrypt.compare` on login |
| 13 | **Zero authentication** — all routes public | JWT-based auth middleware. Login returns signed token (24h expiry) |
| 14 | **NoSQL injection on login** | Validate `typeof email === 'string' && typeof password === 'string'` before query |
| 15 | **Password returned in login response** | Return user object without password field |
| 16 | **No role enforcement server-side** | `requireRole('charity')` middleware on POST /campaigns, POST /spending-requests. `requireRole('donor')` on POST /donations |
| 17 | **Wide-open CORS** | Restrict origin to `http://localhost:3000` |
| 18 | **No rate limiting** | `express-rate-limit` on /login and /register (20 req/15 min) |
| 19 | **No security headers** | Add `helmet()` middleware |
| 20 | **Mass assignment** — `new Campaign(req.body)` | Destructure only expected fields |
| 21 | **Error messages leak internals** | Generic client errors, `console.error` for debugging |
| 22 | **Unvalidated parseInt** | `safeParseInt()` helper with NaN check |

**New routes:**
- `GET /me` — validate JWT, return user (for session restoration)
- `PUT /profile` — update fullName (auth required)
- `PUT /change-password` — verify current, hash new (auth required)
- `POST /upload` — multer image upload, charity only
- `POST /campaign-updates` — charity posts progress update
- `GET /campaign-updates/:campaignId` — list updates
- Pagination on all list endpoints (`?page=1&limit=20`)

**New schema:** `CampaignUpdate` (campaignId, title, content, createdBy, createdAt)

---

## PHASE 3: Frontend Auth Integration — COMPLETED

| File | Changes |
|------|---------|
| `utils/ethereum.js` | JWT token management (`setAuthToken`, `getAuthToken`, `clearAuthToken`), attach `Authorization: Bearer` header to all `apiFetch` calls, `restoreSession()` function, env vars (`REACT_APP_API_URL`, `REACT_APP_CHAIN_ID`), new `formatTokenAmount(wei, decimals)` utility |
| **NEW** `components/PrivateRoute.js` | Route guard — redirects to /login if no user, supports `requiredRole` prop |
| `App.js` | `useEffect` restores session on mount via `restoreSession()`, wrap `/dashboard` and `/my-donations` routes with `<PrivateRoute>`, logout calls `clearAuthToken()`, add session loading screen |
| `Login.js` | Store JWT token on success via `setAuthToken(data.token)`, add `htmlFor`/`id` on form labels |
| `Register.js` | Add `htmlFor`/`id` on form labels |

---

## PHASE 4: Frontend Bug Fixes (12 issues) — COMPLETED

| # | Issue | File | Fix |
|---|-------|------|-----|
| 23 | **Stablecoin donations broken** — always sends ETH | Home.js | Detect currency → if stablecoin: `tokenContract.approve()` then `contract.donateStablecoin()`. Import IERC20 ABI |
| 24 | **`formatEth` wrong for stablecoins** (18 vs 6 decimals) | ethereum.js, CampaignDetail.js | New `formatTokenAmount(wei, decimals)` — use 6 for stablecoins, 18 for ETH |
| 25 | **No role checks in action functions** | Home.js, Dashboard.js, CampaignDetail.js | Add `if (user?.role !== 'donor')` / `'charity'` guard at top of every action function |
| 27 | **3 duplicate `getCampaignStatus`** | Home.js, Dashboard.js, CampaignDetail.js | Extract to **NEW** `utils/campaignHelpers.js`, import everywhere |
| 28 | **String comparison for funded status** | campaignHelpers.js | Use raw BigInt values (`raisedAmountRaw >= targetRaw`), not formatted strings |
| 29 | **Expired campaigns accept donations** | Home.js | Check `deadline > 0 && Date.now()/1000 > deadline`, disable donate controls |
| 30 | **Race condition: `campaignCount` after tx** | Dashboard.js | Parse `CampaignCreated` / `RequestCreated` event from tx receipt instead |
| 32 | **Silent catch blocks** | All pages | Add `console.warn` or `toast.error` for meaningful failures |
| 33 | **Missing "Completed" status** | campaignHelpers.js | Add: if `disbursed >= raised` → "Completed" |
| 34 | **Hardcoded ETH/GBP rate (2150)** | Home.js | Fetch from CoinGecko API on mount, fallback to hardcoded |
| 35 | **Hardcoded min contribution (0.01)** | Dashboard.js | Add input field in campaign creation form |
| 36 | **Hardcoded API_URL and CHAIN_ID** | ethereum.js | Use `process.env.REACT_APP_*` env vars |

---

## PHASE 5: New Features (strengthens dissertation) — COMPLETED

### 5.1 Campaign Updates / Milestones
- Charities post text updates on their campaigns (title + content)
- Donors see a timeline of progress in CampaignDetail.js
- **Why:** Directly addresses Charity Commission transparency findings

### 5.2 Donation Receipts
- **NEW** `components/DonationReceipt.js` — modal with tx hash, amount, date, campaign, wallet
- Print button (CSS `@media print` query)
- Receipt button on MyDonations.js and CampaignDetail.js donation list
- **Why:** Blockchain-verified receipts = immutable proof of giving

### 5.3 Campaign Image Upload
- Multer-based image upload endpoint (max 5MB, jpg/png/webp)
- Upload input in Dashboard.js campaign creation form
- Stored in `frontend/public/uploads/`
- **Why:** Makes campaigns look professional instead of placeholder images

### 5.4 User Profile Page
- **NEW** `pages/Profile.js` — view info, edit name, change password, wallet display
- New route `/profile` in App.js, link in Navbar
- **Why:** Standard web app feature, demonstrates full-stack competence

### 5.5 Enhanced Spending Category Icons
- Icon mapping per category (Medical 🏥, Education 📚, Transport 🚗, etc.)
- Displayed in CampaignDetail.js spending requests table

---

## PHASE 6: Accessibility & Polish — COMPLETED

| # | Issue | Fix |
|---|-------|-----|
| 37 | Form labels missing `htmlFor`/`id` | Add proper associations across Login, Register, Dashboard forms |
| 38 | Tabs need ARIA | Add `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"` to Dashboard tabs |
| 39 | Search input needs label | Add `aria-label="Search campaigns"` to Home.js |
| 40 | Data table needs caption | Add `<caption className="sr-only">` to CampaignDetail spending requests table |
| 41 | Skip navigation missing | Add skip link (`<a href="#main-content">Skip to main content</a>`) in App.js + CSS |
| — | Screen-reader-only class | Add `.sr-only` CSS utility |
| — | Print stylesheet | `@media print` to isolate receipt for printing |

---

## PHASE 7: Compile, Deploy, Verify — COMPLETED

1. `npm install bcrypt jsonwebtoken helmet express-rate-limit multer` (root)
2. `mkdir -p frontend/public/uploads`
3. Create `frontend/.env` with API_URL and CHAIN_ID
4. `npx truffle compile && npx truffle migrate --network ganache --reset`
5. Clear MetaMask activity data (both accounts)
6. Drop MongoDB: `mongosh --eval 'use("charity-platform-v3"); db.dropDatabase()'`
7. Restart backend + frontend

**End-to-end verification:**
- Register charity → verify bcrypt hash in DB
- Register donor → login → verify JWT stored in localStorage
- Refresh page → verify session persists
- Create campaign with image upload and custom min contribution
- Donate ETH → verify on-chain + DB + receipt
- Create spending request → donor votes → verify auto-release at >50%
- Cancel campaign → claim proportional refund
- Post campaign update → verify in CampaignDetail
- Verify Dashboard redirects to /login when not logged in
- Verify charities cannot vote, donors cannot create campaigns

---

## PHASE 8: Advanced Smart Contract Features — COMPLETED

### 8.1 Automated Phased Milestones
- `createCampaign()` now accepts optional parallel arrays: `_phaseDescs[]`, `_phaseTargets[]`, `_phaseVendors[]`
- Phase targets must be cumulative and ascending; final phase target must equal campaign target
- `donate()` calls `_checkPhaseThreshold()` after every ETH donation
- When `raisedAmount >= phase.targetAmount`, a spending `Request` is auto-created for that phase
- WHILE loop triggers multiple phases per donation (whale donation fix, capped at 5 per tx)
- `currentPhase` advances on each trigger; phases can be in voting simultaneously
- New view functions: `getPhaseCount()`, `getCurrentPhase()`, `getPhase()`
- New event: `PhaseTriggered(campaignId, phaseIndex, requestId, description)`

### 8.2 Hybrid Auto-Refunds on Cancel
- `cancelCampaign()` now auto-loops through all `campaignDonors[]` and pushes proportional refunds
- Uses try/catch per donor — one failed refund does NOT block others
- `refundProcessed` mapping tracks which donors have been refunded
- Failed auto-refunds: state is restored so donor can use manual `claimRefund()` fallback
- `cancelCampaign()` auto-refund batch capped at MAX_AUTO_REFUND_BATCH (20) to prevent gas DoS
- `continueRefunds(campaignId, start, batchSize)` for campaigns with 20+ donors
- `claimRefund()` updated with `require(!refundProcessed)` guard
- New events: `AutoRefundSent`, `AutoRefundFailed`
- New view functions: `isRefunded()`, `getDonorCount()`

### 8.3 Frontend Updates
- Dashboard.js: Phase input UI (enable/disable toggle, add/remove phases, cumulative target + vendor per phase)
- CampaignDetail.js: Visual phase timeline showing funded/voting/upcoming status with progress bars
- Cancel campaign now shows "automatically refund all donors" message
- "Refunded" badge shown when donor's auto-refund succeeded

---

## PHASE 9: Security Hardening + AI + Web3 Login + MockUSDT — COMPLETED

### 9.1 Smart Contract Security Hardening
- Inline `ReentrancyGuard` (`nonReentrant` modifier) on: `approveRequest`, `finalizeRequest`, `claimRefund`, `cancelCampaign`, `continueRefunds`
- Whale donation fix: `_checkPhaseThreshold` changed from `if` → `while` loop (capped at `MAX_PHASES_PER_DONATION = 5`)
- Auto-refund DoS prevention: `cancelCampaign` batch capped at `MAX_AUTO_REFUND_BATCH = 20`
- Constants exposed as public for frontend reference

### 9.2 MockUSDT.sol — Test Stablecoin
- **NEW** `contracts/MockUSDT.sol` — ERC-20 token with 6 decimals
- Open `faucet(address, amount)` function for minting test tokens
- Auto-deployed and linked to CharityPlatform in migration script

### 9.3 MetaMask Web3 Login (Backend)
- `POST /auth/nonce` — returns cryptographic nonce for wallet address
- `POST /auth/web3` — verifies signed nonce via `ethers.verifyMessage()`, issues JWT
- Nonce rotated after every successful login (prevents replay attacks)
- User schema updated: `nonce` field with `crypto.randomBytes(32)` default
- `walletAddress` now unique index (prevents duplicate wallet registrations)

### 9.4 Vertex AI / Gemini Integration (Backend)
- `POST /ai/generate-campaign` — AI generates campaign description, trust score (1-100), phases
- `POST /ai/analyze-request` — AI evaluates spending request feasibility for donor voting
- Results cached in MongoDB (SpendingRequest.aiAnalysis) to avoid redundant API calls
- Graceful fallback when `GEMINI_API_KEY` not set (503 with clear message)
- Uses `@google/generative-ai` package with `gemini-2.5-flash` model + `dotenv` for env management

### 9.5 Public API Integrations (Backend) — 7 APIs from [public-apis](https://github.com/Amrindergithub/public-apis) repo
- `GET /api/eth-price` — CoinGecko proxy with 60-second cache (GBP, USD, EUR + 24h % change)
- `GET /api/countries` — REST Countries API (250 countries with names, flags, ISO codes)
- `GET /api/crypto-assets` — Coinpaprika (ETH, BTC, USDT prices + 24h change + market cap)
- `GET /api/exchange-rates` — Frankfurter/ECB (30+ fiat currency exchange rates, 5min cache)
- `GET /api/btc-price` — Blockchain.info (BTC price in GBP/USD/EUR)
- `GET /api/geolocate` — ip-api.com (visitor country, city, region, ISP, timezone, coordinates)
- `GET /api/crypto-prices` — CryptoCompare (multi-crypto multi-fiat price matrix: ETH, BTC, USDT, USDC vs GBP, USD, EUR)

### 9.6 Schema Updates
- **User**: added `nonce` field, `walletAddress` unique index
- **Campaign**: added `aiTrustScore`, `aiAnalysis`, `aiGeneratedDescription`, `phases[]`
- **SpendingRequest**: added `aiAnalysis { score, report, analyzedAt }`
- **Donation**: added `mUSDT` to currency enum

### 9.7 Frontend UI Updates (Step C)
- **ethereum.js**: Added `web3Login()` (nonce request → MetaMask sign → verify), `aiGenerateCampaign()`, `aiAnalyzeRequest()` helpers
- **Login.js**: "Connect with MetaMask" Web3 login button with OR divider above email/password form. Nonce-signing flow with replay attack prevention
- **Dashboard.js**: "Generate with AI" button next to description field. AI auto-fills description + phases + shows trust score. AI metadata (`aiTrustScore`, `aiAnalysis`, `aiGeneratedDescription`, `phases[]`) passed to MongoDB on campaign creation
- **CampaignDetail.js**: "AI Advisor" button on each pending spending request (donor-only). Shows AI feasibility analysis with score badge inline. "Continue Refunds" button for managers on cancelled campaigns (batch >20 donors)

### 9.8 Step D: Test & Document
- Installed `dotenv` for environment variable management from `.env` file
- Created root `.env` with `GEMINI_API_KEY` and `JWT_SECRET`
- Moved Gemini key out of `frontend/.env` (frontend should never hold API secrets)
- Upgraded Gemini model from `gemini-2.0-flash` → `gemini-2.5-flash`
- Fixed frontend AI helper field names (`goal` → `goalETH`, `value` → `valueETH`, `requestId` → `requestIndex`)
- **API Smoke Tests (all passed):**
  - `GET /api/eth-price` — returns GBP/USD/EUR (60s cache)
  - `GET /api/countries` — returns 250 countries
  - `POST /auth/nonce` — returns nonce for registered wallet; rejects unregistered
  - `POST /ai/generate-campaign` — AI generates description, trust score (85/100), 3 phases
  - `POST /ai/analyze-request` — AI scores request feasibility (cached on second call)
  - `GET /me` — session restore via JWT
  - `GET /stats` — platform-wide statistics
  - Role enforcement — donor blocked from `POST /campaigns` (403)
- **Frontend build** — compiles with zero errors

---

## PHASE 10: Bug Fixes, UX Improvements, Public API Dashboard — COMPLETED

### 10.1 Web3 Login Nonce Fix
- **Root cause:** Users registered before Phase 9 had no `nonce` field in MongoDB. Mongoose `default: generateNonce` created in-memory nonce on every `findOne` but never persisted it, so the nonce used for signing (from `/auth/nonce`) was different from the nonce used for verification (from `/auth/web3`).
- **Fix:** Query raw MongoDB document via `User.collection.findOne()` to check if nonce actually exists in DB. If not, persist a new nonce before returning it.

### 10.2 Campaign Creation Schema Fix
- `aiGeneratedDescription` was `Boolean` in schema but frontend sends `String` — changed to `{ type: String, default: null }`
- Phase schema used `vendorAddress` but frontend sends `vendor` — renamed to `vendor: String`

### 10.3 AI Advisor Auto-Load for Donors
- AI spending request analysis now auto-loads via `useEffect` when donors open campaign detail (no button click required)
- AI analysis hidden from charity role (only shown to donors)
- Removed manual "AI Advisor" button — replaced with automatic loading on page open

### 10.4 Cancelled Campaign UI Fixes
- Phase timeline shows "Cancelled" with red X icon when campaign is cancelled (was showing "Voting in Progress")
- Status column shows red "Cancelled" badge instead of "Pending"
- Action column shows "Cancelled — Donors refunded" text instead of vote button
- Transparency Board shows "Campaign Cancelled" badge instead of "You can vote"
- Cancel modal now includes reason textarea — cancellation reason auto-posted as campaign update
- Campaign updates form remains visible on cancelled campaigns (charities can still post updates)

### 10.5 Continue Refunds Fix
- `continueRefunds()` contract function requires 3 arguments: `(campaignId, startIndex, batchSize)`
- Frontend was only passing 1 argument — fixed to find first unrefunded donor index and pass all 3 args
- Added refund progress tracking: shows "X/Y donors refunded" with progress
- Shows "All N donors refunded" green badge when all refunds are complete

### 10.6 Market Data Page (7 Public APIs from public-apis repo)
- **NEW** `frontend/src/pages/MarketData.js` — Full-page dashboard displaying live data from all 7 public APIs
- Added `/market-data` route in `App.js` and "Market Data" link in `Navbar.js`
- Auto-refreshes every 60 seconds with manual refresh button
- Displays:
  - **ETH Price** (CoinGecko) — USD/GBP/EUR + 24h % change with color-coded arrows
  - **BTC Price** (Blockchain.info) — USD/GBP/EUR
  - **Crypto Assets** (Coinpaprika) — ETH, BTC, USDT with prices + 24h change
  - **Multi-Currency Price Matrix** (CryptoCompare) — Table of crypto vs fiat prices
  - **Fiat Exchange Rates** (Frankfurter) — 30+ currencies from ECB data
  - **Visitor Geolocation** (ip-api.com) — Country, city, ISP, timezone, coordinates
  - **Countries Database** (REST Countries) — 250 countries with flags
- API source badges and integration info section linking to `Amrindergithub/public-apis` repo

### 10.7 CoinGecko Enhancement
- Updated `/api/eth-price` endpoint to include `include_24hr_change=true` parameter
- Response now includes `usd_24h_change`, `gbp_24h_change`, `eur_24h_change` fields

---

## PHASE 11: Solar Nocturne UI Redesign — COMPLETED

### 11.1 Design System Extraction
- Cataloged 12 Stitch HTML mockups in OVO Redsun / Solar Nocturne style
- Created `.stitch/DESIGN.md` — full design system: colors, typography, components, layout, motion, icons
- Created `.stitch/SITE.md` — page-to-component mapping with implementation checklist
- Created `.stitch/UI-RULES.md` — 60-30-10 color rule, interaction timing, anti-patterns

### 11.2 Design Tokens (`frontend/src/index.css`)
- Google Fonts: Space Grotesk (300-900), Inter (300-700), JetBrains Mono (400-700)
- CSS custom properties: full Solar Nocturne palette (`--sn-*`), typography, spacing, radius, motion, shadows
- Dark gradient background with SVG `fractalNoise` film grain at 0.03 opacity
- Utilities: `.glass-panel`, `.ghost-border`, `.solar-bloom`, `.pulse-orb`, `.grain-overlay`
- Selection, scrollbar, skip-link styles

### 11.3 Shared Components Rewrite
- **Navbar** (`Navbar.js` + `Navbar.module.css`): 80px glass panel header, network dot indicator, wallet pill, Material Symbols icons, mobile hamburger with Escape close
- **Footer** (`Footer.js` + `Footer.module.css`): 4-column layout, "SOLAR NOCTURNE" brand, gradient divider
- **Toast**: dark glass panel with 4px accent left border, Material Symbols icons
- **Modal**: dark overlay blur, ghost-border content, primary-container confirm button, focus trapping preserved
- **Skeleton**: `#2A2A2A` shimmer, ghost-border cards
- **ProgressBar**: secondary-to-primary gradient, solar-bloom on complete
- **StatCard**: Material Symbols icon strings, solar-bloom hover lift
- **DonationReceipt**: glass panel, JetBrains Mono for tx hash, print CSS preserved
- **ErrorBoundary**: dark theme, Material Symbols error icon

### 11.4 Page Rewrites (all 11 pages, CSS Modules)
- **Home**: hero with pulse orb, price ticker (ETH/BTC), stats panel, glass search bar, category pills, status badges, image gradient overlay cards
- **Dashboard**: "Command Center" 3 hero stat cards with sparklines, pill-shaped tab bar with orange glow, AI Campaign Creator module with pulsing icon, ghost-border campaign cards
- **CampaignDetail**: 614px hero with gradient + AI badges, creator bar with verified icon, sticky funding sidebar, navigation tabs, phase timeline, governance modals
- **TransparencyDashboard**: "Celestial Ledger" hero, 4-column stats bento, Transparency Flow bar chart, Network Health spinning ring, audit trail timeline
- **Analytics**: "Impact Analytics" display-lg, 4-column metrics with trend indicators, Recharts themed with `#FF5C00`, custom pie legend
- **MyDonations**: hero stat panel with pulse orb, 3-column bento portfolio, status badges, receipt buttons
- **Profile**: 4/8 column layout, Identity Management / Security Protocol / Communication sections, "Sync Ledger Profile" action footer
- **MarketData**: display-lg header with synchronized badge, ETH/BTC sparkline cards, asset ledger table, matrix panel, fiat grid, geo rows
- **Login**: glassmorphism card with pulse orb background, password show/hide toggle, MetaMask gradient button
- **Register**: "Initialize Node" header, Donor/Charity role selection cards, "Identity Genesis" form section
- **NotFound**: 10rem "404" with bloom text-shadow, pulse orb background

### 11.5 Build Cleanup
- Removed unused code: `categoryClass`, `getGBP`, `RATES_TO_GBP`, `ethGbpRate`, `curCurrency`/`curAmount` (Home.js); `CATEGORY_ICONS` (CampaignDetail.js); `shortenAddress` import (Profile.js)
- Final build: **zero warnings**, 4,500+ lines of business logic preserved through the restyle

---

## PHASE 12: Polygon Layer 2 Support + Decentralised Identity — COMPLETED

### 12.1 Polygon Amoy Testnet Deployment Support
- **truffle-config.js** — Added `polygon_amoy` network config (chain ID 80002, HDWalletProvider, 30 Gwei gas price)
- **package.json** — Added `deploy:polygon` script: `truffle migrate --network polygon_amoy --reset`
- **.env** — Added `DEPLOYER_PRIVATE_KEY` and `POLYGON_AMOY_RPC` environment variables
- **@truffle/hdwallet-provider** already in dependencies — no new install needed
- Contracts are EVM-compatible: zero code changes required for Polygon deployment

### 12.2 Multi-Chain Contract Resolution
- **ethereum.js** — Added `CHAIN_NAMES` map (Ganache, Polygon Amoy, Polygon Mainnet, Ethereum Mainnet)
- **ethereum.js** — Added `getChainName(chainId)` export for UI display
- **ethereum.js** — Updated `getContractAddress()` with fallback: if contract not found on configured CHAIN_ID, checks all deployed networks in Truffle artifact

### 12.3 On-Chain Decentralised Identity (Smart Contract)
- **CharityPlatform.sol** — Added `DonorIdentity` struct tracking: `totalCampaignsBacked`, `totalEthDonated`, `totalStablecoinDonated`, `totalVotesCast`, `firstActivityTimestamp`, `exists`
- Added `donorIdentities` mapping and `IdentityUpdated` event
- Added `_updateDonorIdentity()` internal helper called from `donate()`, `donateStablecoin()`, and `approveRequest()`
- First donation auto-sets `firstActivityTimestamp` and increments `campaignsBacked` using existing `donorContributions` mapping
- **Reputation scoring algorithm:** `campaigns×10 + (ethDonated/0.1ETH)×5 + votes×3`, capped at 1000
- **Reputation tiers:** Unranked(0) → Observer(1) → Contributor(25) → Guardian(100) → Champion(250) → Legend(500)
- Added `getDonorIdentity()` view function (returns 6 fields + computed reputation score)
- Added `getReputationTier()` view function (returns tier 0-5)

### 12.4 Profile Page On-Chain Identity Display
- **Profile.js** — Added `useEffect` to fetch on-chain identity via `getDonorIdentity()` and `getReputationTier()`
- Stats bento grid now shows live data: Reputation Score, Campaigns Backed, ETH Donated, Votes Cast
- Tier badge dynamically colored using `TIER_COLORS` array (6 tiers from grey to solar orange)
- Graceful fallback: shows "--" placeholders if wallet not connected or contract call fails

---

## Files Changed Summary

| File | Type | Key Changes |
|------|------|-------------|
| `blockchain/contracts/CharityPlatform.sol` | MODIFY | 11 security fixes + phased milestones + hybrid auto-refunds + ReentrancyGuard + whale fix + DoS cap + DonorIdentity struct + reputation scoring + reputation tiers |
| `blockchain/contracts/MockUSDT.sol` | **NEW** | ERC-20 test stablecoin (6 decimals, open faucet) |
| `blockchain/migrations/1_deploy_charity_platform.js` | MODIFY | Deploys both contracts + auto-links MockUSDT |
| `truffle-config.js` | **NEW** | Truffle + Ganache config (replaced hardhat.config.js) + Polygon Amoy testnet network |
| `backend/index.js` | MAJOR REWRITE | Auth, security, new routes, pagination, Web3 login, Gemini AI, 7 public API proxies (CoinGecko, Coinpaprika, Blockchain.info, CryptoCompare, Frankfurter, REST Countries, ip-api.com), nonce persistence fix |
| `frontend/src/utils/ethereum.js` | MODIFY | JWT management, env vars, formatTokenAmount, Web3 login, AI helpers, multi-chain CHAIN_NAMES, getChainName(), fallback contract resolution |
| `frontend/src/utils/campaignHelpers.js` | **NEW** | Shared getCampaignStatus |
| `frontend/src/components/PrivateRoute.js` | **NEW** | Route guard |
| `frontend/src/components/DonationReceipt.js` | **NEW** | Printable receipt |
| `frontend/src/components/Footer.js` | **NEW** | Site footer |
| `frontend/src/components/Modal.js` | **NEW** | Reusable modal component |
| `frontend/src/components/Toast.js` | **NEW** | Notification system |
| `frontend/src/components/Skeleton.js` | **NEW** | Loading skeleton placeholder |
| `frontend/src/pages/Profile.js` | **NEW** | User profile page + on-chain identity display (reputation score, tier badge, live stats from contract) |
| `frontend/src/pages/Analytics.js` | **NEW** | Platform analytics & charts |
| `frontend/src/pages/MarketData.js` | **NEW** | Live data dashboard from 7 public APIs (auto-refresh, source badges, integration info) |
| `frontend/src/pages/Home.js` | MODIFY | Stablecoin fix, role checks, expired UI, live rate |
| `frontend/src/pages/Dashboard.js` | MODIFY | Role checks, min contribution, image upload, event parsing, ARIA, **phase input UI**, **AI Generate button**, AI metadata in apiPost |
| `frontend/src/pages/CampaignDetail.js` | MODIFY | Campaign updates, receipt, category icons, shared status, **phase timeline, auto-refund UI**, **AI auto-load for donors**, Continue Refunds (3-arg fix), cancelled campaign UI (status badges, reason modal, refund progress tracking) |
| `frontend/src/pages/Login.js` | MODIFY | JWT storage, label IDs, **MetaMask Web3 login button** |
| `frontend/src/pages/Register.js` | MODIFY | Label IDs |
| `frontend/src/pages/MyDonations.js` | MODIFY | Receipt buttons |
| `frontend/src/pages/TransparencyDashboard.js` | MODIFY | Enhanced blockchain stats |
| `frontend/src/components/Navbar.js` | MODIFY | Profile link, footer integration, Market Data nav link, active page indicator, mobile hamburger, network status |
| `frontend/src/components/ProgressBar.js` | MODIFY | Enhanced progress display |
| `frontend/src/components/StatCard.js` | MODIFY | Enhanced stats display |
| `frontend/src/App.js` | MODIFY | Session restore, PrivateRoute, skip-link, new routes (/market-data) |
| `frontend/src/App.css` | MODIFY | sr-only, skip-link, print media |
| `.env` | **NEW** | Backend secrets (GEMINI_API_KEY, JWT_SECRET) — loaded via dotenv |
| `frontend/.env` | **NEW** | Frontend environment variables (API_URL, CHAIN_ID) |
| `package.json` | MODIFY | New dependencies, Truffle scripts |
| `README.md` | **NEW** | Comprehensive project documentation (replaced SETUP_GUIDE.md) |
| `frontend/src/index.css` | **REWRITE** | Solar Nocturne design tokens (CSS custom properties), Google Fonts, film grain, utilities |
| `frontend/src/App.css` | **REWRITE** | Shared component styles aligned to Solar Nocturne palette |
| `frontend/src/pages/*.module.css` | **NEW** | Per-page CSS Modules (Home, Dashboard, CampaignDetail, TransparencyDashboard, Analytics, MyDonations, Profile, MarketData, Auth) |
| `frontend/src/components/*.module.css` | **NEW/REWRITE** | Navbar, Footer CSS Modules for Solar Nocturne |
| `.stitch/DESIGN.md` | **NEW** | Solar Nocturne design system spec (colors, typography, components, motion) |
| `.stitch/SITE.md` | **NEW** | Page-to-component implementation map |
| `.stitch/UI-RULES.md` | **NEW** | UI/UX rules, interaction timing, anti-patterns |
