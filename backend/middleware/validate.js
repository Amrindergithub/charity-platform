const { ethers } = require('ethers');

function validateWalletAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateTxHash(hash) {
  if (!hash || typeof hash !== 'string') return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

function validateIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  // IPv4 only
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every(n => parseInt(n) >= 0 && parseInt(n) <= 255);
}

function sanitizeForPrompt(str) {
  if (!str || typeof str !== 'string') return '';
  // Strip potential prompt injection markers
  return str.replace(/ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi, '[filtered]')
    .replace(/\bsystem\s*:/gi, '[filtered]')
    .replace(/\brole\s*:\s*system/gi, '[filtered]')
    .substring(0, 1000); // Cap length
}

function safeParseInt(val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0) throw Object.assign(new Error('Invalid numeric parameter'), { status: 400 });
  return n;
}

function validateString(val, fieldName, maxLength = 500) {
  if (!val || typeof val !== 'string') {
    throw Object.assign(new Error(`${fieldName} is required and must be a string`), { status: 400 });
  }
  if (val.trim().length === 0) {
    throw Object.assign(new Error(`${fieldName} cannot be empty`), { status: 400 });
  }
  if (val.length > maxLength) {
    throw Object.assign(new Error(`${fieldName} exceeds maximum length of ${maxLength}`), { status: 400 });
  }
  return val.trim();
}

function validateNumber(val, fieldName, { min = 0, max = Infinity } = {}) {
  const n = parseFloat(val);
  if (isNaN(n)) throw Object.assign(new Error(`${fieldName} must be a number`), { status: 400 });
  if (n < min) throw Object.assign(new Error(`${fieldName} must be at least ${min}`), { status: 400 });
  if (n > max) throw Object.assign(new Error(`${fieldName} must be at most ${max}`), { status: 400 });
  return n;
}

module.exports = { validateWalletAddress, validateTxHash, validateIP, sanitizeForPrompt, safeParseInt, validateString, validateNumber };
