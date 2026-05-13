# TrustChain — Blockchain-Based Charity Donation Platform with DAO Governance

A full-stack decentralised charity platform built on Ethereum that brings transparency, accountability, and democratic governance to charitable donations. Donors contribute ETH (or ERC-20 stablecoins) to campaigns, and funds can only be released through DAO-style voting — ensuring charities spend donations as promised.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Smart Contract Deployment](#smart-contract-deployment)
- [Running the Application](#running-the-application)
- [MetaMask Configuration](#metamask-configuration)
- [User Guide](#user-guide)
- [Smart Contract Security](#smart-contract-security)
- [Backend Security](#backend-security)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## Features

### Core Platform
| Feature | Description |
|---------|-------------|
| **Dual-Role Authentication** | Register as Donor or Charity Organisation with MetaMask wallet binding |
| **Campaign Creation** | Charities publish fundraising campaigns to blockchain + MongoDB |
| **ETH Donations** | Donors send ETH via MetaMask, recorded immutably on-chain |
| **Stablecoin Support** | Accept USDT, USDC, and DAI donations (ERC-20) |
| **DAO Voting Governance** | Donors vote on spending requests — >50% approval required to release funds |
| **Auto-Release** | When a vote tips over 50%, funds are released automatically in the same transaction |
| **Spending Requests** | Charities must create and get approval before withdrawing any funds |
| **Automated Phased Milestones** | Campaigns define phases with vendor addresses; spending requests auto-create when funding thresholds are reached |
| **Hybrid Auto-Refunds** | Campaign cancellation automatically refunds all donors; manual `claimRefund` as fallback |
| **MockUSDT Test Stablecoin** | Deployable ERC-20 token with 6 decimals and faucet for testing stablecoin donations |
| **Campaign Image Upload** | Multer-based image upload (5MB max, JPEG/PNG/WebP) |
| **Campaign Updates/Milestones** | Charities post progress updates visible to donors |

### AI & Web3
| Feature | Description |
|---------|-------------|
| **MetaMask Web3 Login** | Sign-in via wallet signature — cryptographic nonce prevents replay attacks |
| **AI Campaign Builder** | Gemini AI generates campaign descriptions, trust scores, and proposed phases |
| **AI Donor Advisor** | AI analyses spending requests for feasibility, advising donors before they vote |
| **Live ETH Pricing** | CoinGecko API proxy with 60s cache for real-time GBP/USD/EUR + 24h change |
| **Country Data** | REST Countries API for campaign location context |
| **Market Data Dashboard** | Live data from 7 public APIs — crypto prices, fiat exchange rates, geolocation |

### Decentralised Identity & Multi-Chain
| Feature | Description |
|---------|-------------|
| **On-Chain Donor Identity** | DonorIdentity struct tracks campaigns backed, ETH donated, stablecoin donated, votes cast, first activity timestamp |
| **Reputation Scoring** | Algorithm: `campaigns×10 + (ETH/0.1)×5 + votes×3`, capped at 1000 — computed on-chain |
| **Reputation Tiers** | 6 tiers: Unranked → Observer → Contributor → Guardian → Champion → Legend |
| **Profile Identity Display** | Live on-chain stats with tier badge, dynamic colours, graceful fallback |
| **Polygon Amoy Support** | Truffle config for Polygon Amoy testnet (chain ID 80002) — contracts deploy with zero code changes |
| **Multi-Chain Resolution** | Contract address resolution with fallback across deployed networks |

### Transparency & Analytics
| Feature | Description |
|---------|-------------|
| **Transparency Dashboard** | Platform-wide blockchain statistics and audit trail |
| **Analytics Page** | Donation trends over time, category breakdowns, platform stats |
| **Progress Bars** | Real-time on-chain funding progress per campaign |
| **Donation History** | Per-donor and per-campaign transaction records |
| **Donation Receipts** | Printable blockchain-verified receipts with tx hash |
| **My Donations** | Donor portfolio showing all contributions across campaigns |

### Security & UX
| Feature | Description |
|---------|-------------|
| **JWT Authentication** | Secure token-based sessions with 24h expiry |
| **bcrypt Password Hashing** | 12 salt rounds for password storage |
| **Role-Based Access Control** | Server-side enforcement — charities can't donate, donors can't create campaigns |
| **Rate Limiting** | 20 requests per 15 minutes on auth endpoints |
| **Private Routes** | Frontend route guards redirect unauthenticated users to login |
| **Session Persistence** | Auto-restore sessions on page refresh via JWT |
| **User Profile Management** | Edit name, change password, view wallet info |
| **Accessibility (ARIA)** | Tab roles, skip navigation, screen-reader-only labels, form associations |

### Design System — Solar Nocturne
| Feature | Description |
|---------|-------------|
| **Dark Web3 Aesthetic** | Premium solar-accent palette (`#FF5C00` primary) on deep obsidian surfaces with film-grain texture |
| **Glassmorphism Panels** | `backdrop-filter: blur(40px) saturate(150%)` on translucent glass surfaces with ghost borders |
| **Typography** | Space Grotesk (headlines, UPPERCASE, tight tracking) + Inter (body) + JetBrains Mono (hashes/addresses) |
| **Material Symbols Outlined** | Consistent icon system across all pages replacing emoji icons |
| **CSS Modules Per Page** | Component-scoped styling with design tokens in `index.css` (`--sn-*` CSS custom properties) |
| **Solar Bloom Effects** | `box-shadow: 0 0 64px rgba(255,92,0,0.05)` glow on active and hovered elements |
| **Pulse Orb Animation** | Radial-gradient bloom orbs on hero sections for depth without clutter |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (:3000)                   │
│  Pages: Home, Login, Register, Dashboard, CampaignDetail,   │
│         TransparencyDashboard, MyDonations, Analytics,       │
│         MarketData, Profile                                  │
├──────────────────────┬──────────────────────────────────────┤
│   ethers.js (Web3)   │      REST API (axios + JWT)          │
├──────────────────────┼──────────────────────────────────────┤
│   Ganache / Polygon  │   Express Backend (:5001)            │
│   Smart Contract     │   MongoDB (charity-platform-v3)      │
│   (CharityPlatform)  │   JWT Auth + bcrypt + Helmet         │
└──────────────────────┴──────────────────────────────────────┘
```

**Dual-storage pattern:** Campaign creation, donations, and voting happen on-chain (immutable, trustless). User accounts, metadata, images, and analytics are stored in MongoDB (flexible, searchable). The frontend reads from both sources and reconciles them.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contract** | Solidity ^0.8.0, Truffle Framework |
| **Blockchain** | Ganache (local) / Polygon (production) |
| **Backend** | Node.js, Express.js 4.18 |
| **Database** | MongoDB with Mongoose 8.0 |
| **Frontend** | React 18, React Router 6 |
| **Web3 Integration** | ethers.js v6 (frontend + backend signature verification) |
| **Authentication** | JWT + bcrypt (email/password), MetaMask Web3 login (nonce-signed) |
| **AI Integration** | Google Gemini 2.5 Flash via `@google/generative-ai` + dotenv |
| **Security** | Helmet, express-rate-limit, CORS, dotenv, inline ReentrancyGuard (Solidity) |
| **File Upload** | Multer (5MB, JPEG/PNG/WebP) |
| **Wallet** | MetaMask browser extension |
| **External APIs** | CoinGecko, Coinpaprika, Blockchain.info, CryptoCompare, Frankfurter, REST Countries, ip-api.com |
| **Test Stablecoin** | MockUSDT (ERC-20, 6 decimals, open faucet) |

---

## Project Structure

```
charity-platform/
│
├── blockchain/
│   ├── contracts/
│   │   ├── CharityPlatform.sol          # Solidity smart contract (DAO governance)
│   │   └── MockUSDT.sol                 # Test ERC-20 stablecoin (6 decimals)
│   └── migrations/
│       └── 1_deploy_charity_platform.js # Truffle deployment script
│
├── backend/
│   ├── index.js                     # Express entry point (modular routing)
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── middleware/
│   │   ├── auth.js                  # JWT auth + role enforcement
│   │   ├── validate.js              # Input validation & sanitisation
│   │   └── errorHandler.js          # Global error handler
│   ├── models/
│   │   ├── User.js                  # User schema (bcrypt, nonce, wallet)
│   │   ├── Campaign.js              # Campaign schema
│   │   ├── Donation.js              # Donation schema (indexed)
│   │   ├── SpendingRequest.js       # Spending request schema (compound index)
│   │   └── CampaignUpdate.js        # Campaign update schema
│   └── routes/
│       ├── auth.js                  # Register, login, Web3 login, profile
│       ├── campaigns.js             # Campaign CRUD
│       ├── donations.js             # Donation CRUD
│       ├── spendingRequests.js      # Spending request CRUD
│       ├── updates.js               # Campaign updates
│       ├── upload.js                # Image upload (Multer)
│       ├── ai.js                    # Gemini AI endpoints (rate limited)
│       ├── proxy.js                 # 7 public API proxies (cached)
│       └── analytics.js             # Platform statistics
│
├── frontend/
│   ├── public/
│   │   └── uploads/                 # Served campaign images
│   ├── src/
│   │   ├── App.js                   # Router + session restore + skip-link
│   │   ├── App.css                  # Global styles + print + sr-only
│   │   ├── pages/
│   │   │   ├── Home.js              # Campaign listing + ETH/stablecoin donations
│   │   │   ├── Login.js             # JWT + MetaMask Web3 login
│   │   │   ├── Register.js          # Dual-role registration + wallet binding
│   │   │   ├── Dashboard.js         # Charity: create campaigns & spending requests
│   │   │   ├── CampaignDetail.js    # Voting board + donation history + updates
│   │   │   ├── TransparencyDashboard.js # Platform-wide blockchain stats
│   │   │   ├── MyDonations.js       # Donor portfolio + receipts
│   │   │   ├── Analytics.js         # Charts & category breakdowns
│   │   │   ├── MarketData.js        # Live data from 7 public APIs
│   │   │   ├── NotFound.js          # 404 page
│   │   │   └── Profile.js           # Account management
│   │   ├── components/
│   │   │   ├── Navbar.js            # Navigation with auth state + mobile menu
│   │   │   ├── Footer.js            # Site footer
│   │   │   ├── Modal.js             # Reusable modal (focus trap, ARIA)
│   │   │   ├── Toast.js             # Notification system
│   │   │   ├── ErrorBoundary.js     # React error boundary
│   │   │   ├── DonationReceipt.js   # Printable receipt with tx hash
│   │   │   ├── ProgressBar.js       # Campaign funding progress (ARIA)
│   │   │   ├── StatCard.js          # Statistics display card
│   │   │   ├── Skeleton.js          # Loading skeleton placeholder
│   │   │   └── PrivateRoute.js      # Auth route guard with role support
│   │   ├── contracts/
│   │   │   ├── CharityPlatform.json # ABI (auto-generated by Truffle)
│   │   │   └── config.js            # Contract address config
│   │   └── utils/
│   │       ├── ethereum.js          # Web3 helpers, JWT management, API calls, Web3 login, AI helpers
│   │       └── campaignHelpers.js   # Shared campaign status logic
│   └── package.json
│
├── .env                              # Backend secrets (GEMINI_API_KEY, JWT_SECRET)
├── .env.example                      # Environment variable template
├── .editorconfig                     # Editor formatting rules
├── .nvmrc                            # Node version (18)
├── .gitignore                        # Git ignore rules
├── truffle-config.js                 # Truffle + Ganache configuration
├── package.json                      # Root dependencies + scripts
├── plan.md                           # Development plan & changelog
└── README.md                         # This file
```

---

## Prerequisites

Install these before setting up the project:

### 1. Node.js (v18 or higher)
```bash
node --version   # Check if installed
```
If not installed, download from https://nodejs.org (LTS version).

### 2. MongoDB
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```
Verify: `mongosh` — you should see a MongoDB shell (type `exit` to leave).

### 3. Ganache (Local Blockchain)
Download from https://trufflesuite.com/ganache/
- Install the .dmg and open Ganache
- Click **QUICKSTART** (Ethereum)
- Verify: RPC SERVER shows `HTTP://127.0.0.1:7545`
- You should see 10 accounts each with 100 ETH

### 4. MetaMask Browser Extension
- Install from https://metamask.io
- Create a wallet if you don't have one

---

## Installation

```bash
# Navigate to the project root
cd charity-platform

# Install backend + Truffle dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

## Smart Contract Deployment

Make sure Ganache is running first.

```bash
# Compile the Solidity contract
npm run compile

# Deploy to Ganache
npm run deploy
```

Expected output:
```
Deploying CharityPlatform...
CharityPlatform deployed at: 0x...
Network: ganache (id: 5777)
```

Truffle automatically writes the compiled ABI + contract address to `frontend/src/contracts/CharityPlatform.json` — no manual configuration needed.

---

## Running the Application

### Start the Backend
```bash
npm start
```
Output:
```
Server running on port 5001
MongoDB Connected
```

### Start the Frontend (in a new terminal)
```bash
cd client
npm start
```
Opens automatically at http://localhost:3000

### NPM Scripts Reference
| Command | Description |
|---------|-------------|
| `npm start` | Start Express backend on port 5001 |
| `npm run compile` | Compile Solidity contracts via Truffle |
| `npm run deploy` | Deploy contracts to Ganache (`--reset`) |
| `npm run console` | Open Truffle console connected to Ganache |
| `npm test` | Run Truffle tests on Ganache |
| `cd frontend && npm start` | Start React dev server on port 3000 |

---

## MetaMask Configuration

### Connect MetaMask to Ganache
1. Open MetaMask → click network dropdown
2. **Add Network** → **Add a network manually**
3. Fill in:
   - **Network Name:** Ganache Local
   - **New RPC URL:** `http://127.0.0.1:7545`
   - **Chain ID:** `1337`
   - **Currency Symbol:** ETH
4. Save and switch to "Ganache Local"

### Import Ganache Accounts
1. In Ganache, click the **key icon** next to an account
2. Copy the **private key**
3. In MetaMask: account icon → **Import Account** → paste private key

**Import at least 2 accounts:**
- **Account 1** → Charity role
- **Account 2** → Donor role

### Important: After Redeployment
After redeploying the contract, you **must** clear MetaMask activity data:
- MetaMask → Settings → Advanced → **Clear Activity Tab Data**
- Do this for **every imported account**

---

## User Guide

### Charity Workflow

1. **Register** at `/register` — select "Charity Organisation", connect MetaMask (Account 1)
2. **Login** with email/password **or** click "Connect with MetaMask" for Web3 login
3. **Create Campaign** — go to Dashboard, fill in title, goal (ETH), click "Generate with AI" to auto-fill description/phases, optional image upload
4. **Create Spending Request** — select campaign, describe the expense, enter amount (must be ≤ raised funds) and recipient wallet address
5. **Post Updates** — share milestone updates with donors from the campaign detail page
6. **Release Funds** — once >50% of donors approve, funds auto-release; or manually finalize

### Donor Workflow

1. **Register** at `/register` — select "Donor", connect MetaMask (Account 2)
2. **Login** with email/password **or** click "Connect with MetaMask" for Web3 login
3. **Browse Campaigns** on the Home page
4. **Donate** — enter amount, confirm in MetaMask (must meet minimum contribution)
5. **Vote on Spending Requests** — go to campaign detail → Transparency Board → AI analysis auto-loads for donors → Approve
6. **View Market Data** — go to Market Data page for live crypto prices, fiat rates, and geolocation from 7 APIs
7. **View Donation History** — go to My Donations page
8. **Download Receipts** — blockchain-verified receipts with transaction hash

### End-to-End Test Flow

| Step | Account | Action |
|------|---------|--------|
| 1 | Account 1 (Charity) | Register + Login |
| 2 | Account 1 (Charity) | Create campaign with 5 ETH goal |
| 3 | Account 1 (Charity) | Create spending request for 2 ETH |
| 4 | — | Logout + switch MetaMask to Account 2 |
| 5 | Account 2 (Donor) | Register + Login |
| 6 | Account 2 (Donor) | Donate 3 ETH to the campaign |
| 7 | Account 2 (Donor) | Vote "Approve" on spending request |
| 8 | — | Funds auto-release (1 donor = 100% approval) |
| 9 | Account 2 (Donor) | Check My Donations + download receipt |

**Note:** The spending request amount must be ≤ the campaign's raised funds. If you request 5 ETH but only 4.8 ETH has been donated, the vote will fail when auto-release triggers because of insufficient funds.

---

## Smart Contract Security

The smart contract has **11 security fixes** and **2 advanced features** applied:

| # | Issue | Severity | Fix Applied |
|---|-------|----------|-------------|
| 1 | **Reentrancy in `_executeRequest`** — state set after transfer | CRITICAL | Checks-Effects-Interactions pattern; `call{value}()` instead of `transfer()` |
| 2 | **Cancelled campaign auto-release** — votes trigger release after cancellation | CRITICAL | `require(!c.cancelled)` guard on `approveRequest` |
| 3 | **Cross-campaign fund pooling** — Campaign A's ETH pays Campaign B | CRITICAL | Per-campaign balance check: `raisedAmount - totalDisbursed >= value` |
| 4 | **Stablecoin min contribution bypass** — 1 wei = full voting rights | HIGH | `require(_amount >= minimumContribution)` on stablecoin donations |
| 5 | **Donations to non-existent campaigns** lock ETH forever | HIGH | `require(_campaignId < campaignCount)` validation |
| 6 | **Refunds ignore disbursed funds** — contract overdraw possible | CRITICAL | Proportional refund: `(contribution × remaining) / totalRaised` |
| 7 | **Manager can vote on own requests** — breaks DAO governance | HIGH | `require(msg.sender != c.manager)` on approve |
| 8 | **`finalizeRequest` works on cancelled campaigns** | HIGH | `require(!c.cancelled)` in `_executeRequest` |
| 9 | **No input validation** — empty names, zero targets accepted | MEDIUM | Require checks on `createCampaign` and `createRequest` |
| 10 | **Stablecoin transfer return value unchecked** | MEDIUM | `require(token.transfer(...))` |
| 11 | **No event for `setStablecoinAddress`** | LOW | Added `StablecoinAddressUpdated` event |

**Advanced Features (Phase 8):**

| # | Feature | Description |
|---|---------|-------------|
| 12 | **Automated Phased Milestones** | Campaigns define phases with cumulative targets and vendor addresses. `donate()` auto-creates voting requests when thresholds are met. While-loop triggers multiple phases per whale donation (capped at 5). |
| 13 | **Hybrid Auto-Refunds** | `cancelCampaign()` pushes proportional refunds automatically (batch capped at 20 for gas safety). `continueRefunds()` handles remaining. `claimRefund()` as manual fallback. |
| 14 | **Inline ReentrancyGuard** | `nonReentrant` modifier on all outbound-transfer functions prevents reentrancy attacks. |
| 15 | **MockUSDT** | Separate ERC-20 contract (6 decimals) with faucet. Auto-linked to CharityPlatform in migration. |

### Key Smart Contract Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createCampaign()` | Anyone | Create a new fundraising campaign |
| `donate()` | Anyone | Donate ETH to a campaign |
| `donateStablecoin()` | Anyone | Donate USDT/USDC/DAI to a campaign |
| `createRequest()` | Manager only | Propose a spending request |
| `approveRequest()` | Donors only | Vote to approve a spending request |
| `finalizeRequest()` | Manager only | Manually release approved funds (fallback) |
| `cancelCampaign()` | Manager only | Cancel campaign, enable refunds |
| `claimRefund()` | Donors only | Claim proportional refund from cancelled campaign |
| `getSummary()` | Public (view) | Get campaign summary data |
| `getRequestDetails()` | Public (view) | Get spending request details |

---

## Backend Security

| Protection | Implementation |
|-----------|---------------|
| **Password Hashing** | bcrypt with 12 salt rounds |
| **Authentication** | JWT tokens with 24-hour expiry |
| **NoSQL Injection Prevention** | Type validation before database queries |
| **Password Excluded from Responses** | Password field never returned in API responses |
| **Role Enforcement** | `requireRole()` middleware on protected endpoints |
| **CORS** | Restricted to `http://localhost:3000` |
| **Rate Limiting** | 20 requests per 15 minutes on `/login` and `/register` |
| **Security Headers** | Helmet middleware for HTTP header hardening |
| **Mass Assignment Prevention** | Explicit field destructuring, no `req.body` pass-through |
| **Safe Error Messages** | Generic client errors, detailed server-side logging |
| **Input Validation** | `safeParseInt()` helper, string type checks |
| **File Upload Validation** | 5MB limit, JPEG/PNG/WebP only via Multer |

---

## API Reference

### Authentication (Email/Password)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create account (rate limited) |
| POST | `/login` | No | Get JWT token (rate limited) |
| GET | `/me` | JWT | Restore session / validate token |
| PUT | `/profile` | JWT | Update full name |
| PUT | `/change-password` | JWT | Change password |

### Authentication (Web3 MetaMask)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/nonce` | No | Get signing nonce for wallet address |
| POST | `/auth/web3` | No | Verify signature, issue JWT (nonce rotated) |

### Campaigns
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/campaigns` | Charity | Create campaign |
| GET | `/campaigns` | No | List all (paginated: `?page=1&limit=20`) |
| GET | `/campaigns/:smartContractId` | No | Get single campaign |
| GET | `/campaigns/by-wallet/:wallet` | No | Get campaigns by creator wallet |

### Donations
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/donations` | Donor | Record a donation |
| GET | `/donations/:campaignId` | No | Get donations for a campaign |
| GET | `/donations/by-wallet/:wallet` | No | Get donor's donation history |

### Spending Requests
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/spending-requests` | Charity | Create spending request |
| GET | `/spending-requests/:campaignId` | No | Get requests for a campaign |

### Campaign Updates
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/campaign-updates` | Charity | Post progress update |
| GET | `/campaign-updates/:campaignId` | No | Get updates for a campaign |

### File Upload
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload` | Charity | Upload campaign image |

### AI (Gemini)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/generate-campaign` | Charity | AI generates description, trust score, phases |
| POST | `/ai/analyze-request` | JWT | AI evaluates spending request feasibility |

### Public API Proxies (from [public-apis](https://github.com/Amrindergithub/public-apis) repository)
| Method | Endpoint | Source API | Auth | Description |
|--------|----------|-----------|------|-------------|
| GET | `/api/eth-price` | CoinGecko | No | Live ETH price in GBP/USD/EUR + 24h % change (60s cache) |
| GET | `/api/crypto-assets` | Coinpaprika | No | ETH, BTC, USDT prices + 24h change + market cap |
| GET | `/api/btc-price` | Blockchain.info | No | BTC price in GBP/USD/EUR |
| GET | `/api/crypto-prices` | CryptoCompare | No | Multi-crypto multi-fiat price matrix (ETH, BTC, USDT, USDC vs GBP, USD, EUR) |
| GET | `/api/exchange-rates` | Frankfurter (ECB) | No | 30+ fiat currency exchange rates (5min cache) |
| GET | `/api/countries` | REST Countries | No | 250 countries with names, flags, ISO codes |
| GET | `/api/geolocate` | ip-api.com | No | Visitor geolocation (country, city, ISP, timezone, lat/lon) |

### Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stats` | No | Platform-wide statistics |
| GET | `/analytics/donations-over-time` | No | Time-series donation data |
| GET | `/analytics/by-category` | No | Campaign category breakdown |

---

## Troubleshooting

### "MetaMask - RPC Error: Internal JSON-RPC error"
Ganache was likely restarted. Fix:
1. MetaMask → Settings → Advanced → **Clear Activity Tab Data**
2. Redeploy: `npm run deploy`

### "Vote failed: missing revert data"
This is Ganache's generic error when a `require()` fails. Common causes:
- **Spending request > raised funds** — the request asks for more ETH than the campaign has. Donate more or create a smaller request
- **Voting as campaign manager** — the manager cannot vote on their own spending requests
- **Not a donor** — only users who donated to that specific campaign can vote
- **Already voted** — each donor can only vote once per request

### Contract not deployed / wrong data
```bash
npm run deploy    # Redeploy contract
```
Truffle auto-updates the ABI and address in `frontend/src/contracts/`.

### MongoDB connection error
```bash
brew services start mongodb-community
```

### Port 5001 already in use
```bash
lsof -ti:5001 | xargs kill -9
npm start
```

### Port 3000 already in use
```bash
lsof -ti:3000 | xargs kill -9
cd frontend && npm start
```

### Fresh start (reset everything)
```bash
# Reset database
mongosh --eval 'use("charity-platform-v3"); db.dropDatabase()'

# Redeploy contract
npm run deploy

# Clear MetaMask activity data for all accounts
# MetaMask → Settings → Advanced → Clear Activity Tab Data

# Restart servers
npm start                  # Terminal 1
cd frontend && npm start     # Terminal 2
```

---

## Database Schema

### MongoDB Collections

**Users**
```
{ fullName, email, password (bcrypt), role (donor|charity), walletAddress (unique), nonce (Web3 auth), createdAt }
```

**Campaigns**
```
{ smartContractId (unique), title, description, goal, category, imageUrl, creator, deadline,
  aiTrustScore, aiAnalysis, aiGeneratedDescription, phases[] }
```

**Donations**
```
{ campaignId, donorWallet, amount, currency (ETH|USDT|USDC|DAI|mUSDT), txHash, createdAt }
```

**SpendingRequests**
```
{ campaignId, requestIndex, description, value, recipient, category, currency,
  aiAnalysis: { score, report, analyzedAt } }
```

**CampaignUpdates**
```
{ campaignId, title, content, creator, createdAt }
```

---

## Environment Configuration

### Root (`.env`) — Backend secrets
```
GEMINI_API_KEY=your-google-ai-studio-key
JWT_SECRET=your-jwt-secret
```
Get your Gemini key at https://aistudio.google.com/apikey — AI features are optional (server gracefully degrades when key is missing).

### Frontend (`frontend/.env`)
```
REACT_APP_API_URL=http://localhost:5001
REACT_APP_CHAIN_ID=1337
```

### Truffle (`truffle-config.js`)
- Network: Ganache at `127.0.0.1:7545` (network_id: `5777`)
- Solidity compiler: `0.8.28` with optimisation (200 runs)
- Contracts directory: `./blockchain/contracts/`
- Build directory: `./frontend/src/contracts/`
- Migrations directory: `./blockchain/migrations/`

---

## Dissertation Context

This platform was built as part of a dissertation investigating blockchain-based solutions for charity transparency. Key contributions:

- **DAO Governance Model** — Donors collectively decide how funds are spent, preventing misuse
- **Immutable Audit Trail** — All transactions recorded on-chain, publicly verifiable
- **Smart Contract Enforcement** — Rules enforced by code, not trust
- **Dual-Storage Architecture** — Blockchain for financial integrity, MongoDB for usability
- **11 Security Fixes** — Addressing reentrancy, cross-campaign attacks, governance manipulation, and more
- **Proportional Refund System** — Fair refunds accounting for already-disbursed funds
- **Stablecoin Support** — Real-world usability with USDT/USDC/DAI alongside ETH
- **7 Public API Integrations** — Real-time market data from CoinGecko, Coinpaprika, Blockchain.info, CryptoCompare, Frankfurter, REST Countries, and ip-api.com (sourced from [public-apis](https://github.com/Amrindergithub/public-apis) repository)
- **AI-Powered Features** — Gemini AI campaign generator and spending request advisor

The platform directly addresses findings from the UK Charity Commission regarding transparency failures in the charitable sector, providing a technical solution that makes donation tracking trustless and verifiable.

### Original Contributions (cited in §1.6)

- **C1.** Open-source UK-focused donor-controlled charity dApp combining DAO governance, hybrid refund semantics and an LLM trust score in a single deployed artefact (chapter 4)
- **C2.** Empirical hallucination-rate measurement of a Gemini 2.5 Flash trust-scoring oracle against twelve controlled charity descriptions (§5.3.6.1)
- **C3.** Reusable adversarial Solidity test suite covering reentrancy, deadline and goal-bypass cases (§4.2.11)
- **C4.** Reproducible per-operation gas profile on Sepolia, comparable against the published academic dApp literature (table 4.4 and §5.3.5)

### Sepolia Deployment

Both contracts are publicly verified on Sepolia Etherscan and Sourcify:

- **CharityPlatform** — `0xaB2400f98e3168737506998B7A8d1e33b1Ed76c2`
- **MockUSDT** — `0x0A410f00358Ce85C23e634d9516A9c0Ba0d917F1`

Compiler: Solidity 0.8.28, optimisation enabled at 200 runs, Paris EVM target.

### Test Suite (16 passing tests against local Ganache)

- **11 happy-path tests** — `blockchain/test/charity_platform.test.js`: campaign creation (with/without phases, empty-name rejection), ether donations (minimum-contribution rejection), stablecoin donations (two-step approve/transferFrom), spending-request creation and auto-finalisation, manager-only cancellation guard, batch refunds, reputation tier returns
- **5 adversarial tests** — `blockchain/test/adversarial.test.js`: re-entrancy via `MaliciousRefundReceiver.sol` malicious receive() hook, deadline bypass via evm_increaseTime, goal bypass after target reached, below-minimum donation rejection, raw ETH transfer rejection

Run all 16: `npx truffle test`

### Empirical AI Hallucination Study

`Documentation/ai_hallucination_study.js` runs 21 controlled prompts against the Gemini 2.5 Flash trust-scoring oracle (10 plausible UK charity descriptions, 5 vague, 5 fraudulent, 1 prompt-injection attempt). 100% expected verdicts on the 12 reportable cases. Run:

```bash
GEMINI_API_KEY=... node Documentation/ai_hallucination_study.js
```

### Dissertation Build Pipeline

`Documentation/build_skeleton.js` builds the full dissertation as a single docx-js document. Run:

```bash
cd Documentation && node build_skeleton.js
```

Output: `Documentation/TrustChain_Dissertation.docx` (~121 MB). User updates Word fields (TOC) before PDF export.

Reference list: 62 entries, all live-verified via Crossref + arXiv + WebFetch + live Chrome navigation. All 161 in-text citations are parenthetical Harvard form, chronologically sorted within multi-cite blocks, with abbreviation expansion at first use for organisation names.
