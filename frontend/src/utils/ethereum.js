import { ethers } from "ethers";
import CharityPlatformArtifact from "../contracts/CharityPlatform.json";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5001";
const CHAIN_ID = parseInt(process.env.REACT_APP_CHAIN_ID || "5777");

// Chain metadata for UI display
export const CHAIN_NAMES = {
  5777: "Ganache (Local)",
  11155111: "Sepolia (Testnet)",
  80002: "Polygon Amoy (Testnet)",
  137: "Polygon Mainnet",
  1: "Ethereum Mainnet"
};

export function getChainName(chainId) {
  return CHAIN_NAMES[chainId || CHAIN_ID] || `Chain ${chainId || CHAIN_ID}`;
}

// ── JWT Token Management ──
export function setAuthToken(token) {
  localStorage.setItem('trustchain_token', token);
}

export function getAuthToken() {
  return localStorage.getItem('trustchain_token');
}

export function clearAuthToken() {
  localStorage.removeItem('trustchain_token');
}

// ── Get contract address from Truffle artifact ──
// Supports multiple networks: checks configured CHAIN_ID first,
// then falls back to detecting the last deployed network
function getContractAddress() {
  const networkData = CharityPlatformArtifact.networks[CHAIN_ID];
  if (networkData && networkData.address) {
    return networkData.address;
  }
  // Fallback: check all deployed networks in the artifact
  const networks = CharityPlatformArtifact.networks;
  const networkIds = Object.keys(networks);
  if (networkIds.length > 0) {
    const lastDeployed = networks[networkIds[networkIds.length - 1]];
    if (lastDeployed && lastDeployed.address) {
      console.warn(`Contract not found on chain ${CHAIN_ID}, using deployment on chain ${networkIds[networkIds.length - 1]}`);
      return lastDeployed.address;
    }
  }
  console.error("Contract not deployed on chain", CHAIN_ID);
  return null;
}

export function getContractAddr() {
  return getContractAddress();
}

// ── Provider & Contract Helpers ──
export function getProvider() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = getProvider();
  return await provider.getSigner();
}

export async function getContract() {
  const address = getContractAddress();
  if (!address) throw new Error("Contract not deployed — run: npm run deploy");
  const signer = await getSigner();
  return new ethers.Contract(address, CharityPlatformArtifact.abi, signer);
}

export async function getReadOnlyContract() {
  const address = getContractAddress();
  if (!address) throw new Error("Contract not deployed");
  const provider = getProvider();
  return new ethers.Contract(address, CharityPlatformArtifact.abi, provider);
}

// ── Wallet Helpers ──
export async function connectWallet() {
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

export function shortenAddress(addr) {
  if (!addr) return "";
  return addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
}

// ── ETH Price Cache (for stablecoin→ETH conversion) ──
let ethPriceCache = { price: null, timestamp: 0 };
const ETH_PRICE_TTL = 60000; // 1 minute cache

export async function getEthUsdPrice() {
  if (ethPriceCache.price && Date.now() - ethPriceCache.timestamp < ETH_PRICE_TTL) {
    return ethPriceCache.price;
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await res.json();
    const price = data?.ethereum?.usd;
    if (price) {
      ethPriceCache = { price, timestamp: Date.now() };
      return price;
    }
  } catch (e) {
    console.warn('ETH price fetch failed:', e.message);
  }
  return ethPriceCache.price || 2500; // fallback
}

export function stablecoinToEth(stablecoinAmount, ethUsdPrice) {
  if (!ethUsdPrice || ethUsdPrice <= 0) return 0;
  return parseFloat(stablecoinAmount) / ethUsdPrice;
}

// ── Multi-fiat ETH price (USD/GBP/EUR via CoinGecko) ──
let ethFiatCache = { data: null, timestamp: 0 };
export async function getEthFiatRates() {
  if (ethFiatCache.data && Date.now() - ethFiatCache.timestamp < ETH_PRICE_TTL) {
    return ethFiatCache.data;
  }
  try {
    const res = await fetch(`${API_URL}/api/eth-price`);
    const data = await res.json();
    if (data && data.usd) {
      ethFiatCache = { data, timestamp: Date.now() };
      return data;
    }
  } catch (e) { console.warn('ETH fiat fetch failed:', e.message); }
  return ethFiatCache.data;
}

// ── Formatting ──
export function formatEth(wei) {
  try {
    return parseFloat(ethers.formatEther(wei)).toFixed(4);
  } catch {
    return "0.0000";
  }
}

export function formatTokenAmount(wei, decimals = 18) {
  try {
    return parseFloat(ethers.formatUnits(wei, decimals)).toFixed(decimals === 6 ? 2 : 4);
  } catch {
    return decimals === 6 ? "0.00" : "0.0000";
  }
}

// ── Session Restoration ──
export async function restoreSession() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const data = await apiFetch('/me');
    return data.user;
  } catch {
    clearAuthToken();
    return null;
  }
}

// ── API Helpers (with JWT) ──
export async function apiFetch(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers,
    ...options,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Server returned an invalid response");
  }
  if (!res.ok) {
    if (res.status === 401) {
      clearAuthToken();
    }
    throw new Error(data.error || data.message || "API Error");
  }
  return data;
}

export async function apiPost(endpoint, body) {
  return apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPut(endpoint, body) {
  return apiFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ── Web3 Login (MetaMask nonce-signing) ──
export async function web3Login() {
  if (!window.ethereum) throw new Error("MetaMask not installed");

  // Get signer — this is the authoritative address
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const wallet = (await signer.getAddress()).toLowerCase();

  // Step 1: request nonce from server
  const nonceData = await apiPost("/auth/nonce", { walletAddress: wallet });
  const message = nonceData.message;

  // Step 2: sign the nonce message with MetaMask
  const signature = await signer.signMessage(message);

  // Step 3: verify signature on server, get JWT
  const authData = await apiPost("/auth/web3", { walletAddress: wallet, signature });
  if (authData.token) {
    setAuthToken(authData.token);
  }
  return authData;
}

// ── AI Helpers ──
export async function aiGenerateCampaign(title, category, goal) {
  return apiPost("/ai/generate-campaign", { title, category, goalETH: goal });
}

export async function aiAnalyzeRequest(requestIndex, campaignId, description, value, category) {
  return apiPost("/ai/analyze-request", { requestIndex, campaignId, description, valueETH: value, category });
}

export { API_URL };
