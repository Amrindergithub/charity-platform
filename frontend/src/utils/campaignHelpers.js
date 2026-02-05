/* global BigInt */

/**
 * Shared campaign status calculation
 * Single source of truth — used by Home, Dashboard, and CampaignDetail
 *
 * @param {Object} chain - On-chain data with raw BigInt values
 * @param {string|BigInt} chain.raisedAmountRaw - Raw wei raised
 * @param {string|BigInt} chain.targetRaw - Raw wei target
 * @param {string|BigInt} chain.totalDisbursedRaw - Raw wei disbursed
 * @param {number} chain.deadline - Unix timestamp (0 = no deadline)
 * @param {boolean} chain.cancelled - Whether campaign is cancelled
 * @returns {{ key: string, label: string } | null}
 */
export function getCampaignStatus(chain) {
  if (!chain) return null;
  if (chain.cancelled) return { key: "cancelled", label: "Cancelled" };
  if (chain.deadline > 0 && Date.now() / 1000 > chain.deadline)
    return { key: "expired", label: "Expired" };

  // Use BigInt comparison for precision (not formatted string comparison)
  const raised = BigInt(chain.raisedAmountRaw || 0);
  const target = BigInt(chain.targetRaw || 0);
  const disbursed = BigInt(chain.totalDisbursedRaw || 0);

  if (target > 0n && raised >= target) {
    if (disbursed >= raised) return { key: "completed", label: "Completed" };
    return { key: "funded", label: "Funded" };
  }
  return { key: "active", label: "Active" };
}

/**
 * Spending request category icons
 */
export const CATEGORY_ICONS = {
  Medical: "\u{1F3E5}",     // 🏥
  Education: "\u{1F4DA}",   // 📚
  Transport: "\u{1F697}",   // 🚗
  Admin: "\u{1F4CB}",       // 📋
  Infrastructure: "\u{1F3D7}", // 🏗️
  Staffing: "\u{1F465}",    // 👥
  Equipment: "\u{2699}",    // ⚙️
  Other: "\u{1F4E6}",       // 📦
};
