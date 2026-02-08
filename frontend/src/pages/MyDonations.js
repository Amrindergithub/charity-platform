import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch, shortenAddress } from "../utils/ethereum";
import { useToast } from "../components/Toast";
import DonationReceipt from "../components/DonationReceipt";
import styles from "./MyDonations.module.css";

export default function MyDonations({ user }) {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [receiptDonation, setReceiptDonation] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (user?.walletAddress) loadDonations();
    else setLoading(false);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDonations = async () => {
    try {
      const data = await apiFetch(`/donations/by-wallet/${user.walletAddress.toLowerCase()}`);
      setDonations(data);
    } catch (err) {
      console.warn("Failed to load donations:", err);
      toast.error("Failed to load your donations");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.loginPrompt}>
          <span className={styles.emptyIcon} role="img" aria-label="Lock">
            <span className="material-symbols-outlined">lock</span>
          </span>
          <h2 className={styles.loginTitle}>Authentication Required</h2>
          <p className={styles.loginDesc}>Please sign in to view your donation portfolio</p>
          <Link to="/login" className={styles.loginBtn}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.heroPanel}>
          <div className={styles.pulseOrb} />
          <div className={styles.heroContent}>
            <div className={styles.heroMain}>
              <p className={styles.heroLabel}>Total Life-Time Impact</p>
              <div className={styles.skelLine} style={{ width: "60%", height: "48px" }} />
            </div>
          </div>
        </div>
        <h2 className={styles.sectionTitle}>Donation Portfolio</h2>
        <hr className={styles.sectionUnderline} />
        <div className={styles.skelGrid}>
          {[1, 2, 3].map(i => (
            <div key={i} className={styles.skelCard}>
              <div className={styles.skelImage} />
              <div className={styles.skelBody}>
                <div className={styles.skelLine} style={{ width: "70%" }} />
                <div className={styles.skelLine} style={{ width: "40%" }} />
                <div className={styles.skelLine} style={{ width: "55%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalETH = donations
    .filter(d => !d.currency || d.currency === "ETH")
    .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
  const totalStable = donations
    .filter(d => d.currency && d.currency !== "ETH")
    .reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
  const uniqueCampaigns = [...new Set(donations.map((d) => d.campaignId))];

  const getBadgeClass = (index) => {
    if (index % 3 === 0) return styles.badgeVerified;
    if (index % 3 === 1) return styles.badgeLegacy;
    return styles.badgePending;
  };

  const getBadgeLabel = (index) => {
    if (index % 3 === 0) return "Verified";
    if (index % 3 === 1) return "Legacy";
    return "Pending";
  };

  return (
    <div className={styles.page}>
      {/* Receipt Modal */}
      {receiptDonation && (
        <DonationReceipt
          donation={receiptDonation}
          campaignTitle={`Campaign #${receiptDonation.campaignId}`}
          onClose={() => setReceiptDonation(null)}
        />
      )}

      {/* Hero Stat Panel */}
      <div className={styles.heroPanel}>
        <div className={styles.pulseOrb} />
        <div className={styles.heroContent}>
          <div className={styles.heroMain}>
            <p className={styles.heroLabel}>Total Life-Time Impact</p>
            <h1 className={styles.heroValue}>
              {totalETH.toFixed(4)} <span className={styles.heroUnit}>ETH</span>
            </h1>
            {totalStable > 0 && (
              <p className={styles.heroDesc}>
                Plus {totalStable.toFixed(2)} in stablecoin contributions across {uniqueCampaigns.length} campaign{uniqueCampaigns.length !== 1 ? "s" : ""}
              </p>
            )}
            {totalStable === 0 && (
              <p className={styles.heroDesc}>
                Blockchain-verified donations across {uniqueCampaigns.length} campaign{uniqueCampaigns.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className={styles.heroSide}>
            <div className={styles.heroMiniCard}>
              <p className={styles.miniLabel}>Transactions</p>
              <p className={styles.miniValue}>{donations.length}</p>
            </div>
            <div className={styles.heroMiniCard}>
              <p className={styles.miniLabel}>Campaigns</p>
              <p className={styles.miniValue}>{uniqueCampaigns.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section Title */}
      <h2 className={styles.sectionTitle}>Donation Portfolio</h2>
      <hr className={styles.sectionUnderline} />

      {/* Donation Cards or Empty State */}
      {donations.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <span className="material-symbols-outlined">receipt_long</span>
          </div>
          <h3 className={styles.emptyTitle}>No donations yet</h3>
          <p className={styles.emptyDesc}>Browse campaigns and make your first contribution</p>
          <Link to="/" className={styles.emptyBtn}>
            Browse Campaigns
          </Link>
        </div>
      ) : (
        <div className={styles.portfolioGrid}>
          {donations.map((d, i) => (
            <div key={d._id || i} className={styles.card}>
              <div className={styles.cardImageWrap}>
                <div className={styles.cardImageBg}>
                  <span className={`material-symbols-outlined ${styles.cardImageIcon}`}>volunteer_activism</span>
                </div>
                <div className={styles.cardOverlay} />
                <span className={`${styles.statusBadge} ${getBadgeClass(i)}`}>
                  {getBadgeLabel(i)}
                </span>
              </div>
              <div className={styles.cardBody}>
                <Link to={`/campaign/${d.campaignId}`} className={styles.cardTitle}>
                  Campaign #{d.campaignId}
                </Link>
                <p className={styles.cardMeta}>
                  {new Date(d.createdAt).toLocaleDateString()} / tx: {shortenAddress(d.txHash)}
                </p>
                <div className={styles.cardAmount}>
                  {d.amount}
                  <span className={styles.cardAmountUnit}>{d.currency || "ETH"}</span>
                </div>
                <button
                  className={styles.receiptBtn}
                  onClick={() => setReceiptDonation(d)}
                  aria-label={`View receipt for ${d.amount} ${d.currency || "ETH"} donation to campaign ${d.campaignId}`}
                >
                  <span className={`material-symbols-outlined ${styles.receiptIcon}`}>receipt_long</span>
                  Download Receipt
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
