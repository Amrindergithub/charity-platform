import { useState, useEffect } from "react";
import { getContract, getProvider, apiFetch, formatEth, formatTokenAmount } from "../utils/ethereum";
import { SkeletonStats } from "../components/Skeleton";
import styles from "./TransparencyDashboard.module.css";

function formatRelativeTime(date) {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function shortenHash(hash) {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}` : hash;
}

export default function TransparencyDashboard() {
  const [dbStats, setDbStats] = useState(null);
  const [chainStats, setChainStats] = useState(null);
  const [flowBuckets, setFlowBuckets] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [trends, setTrends] = useState(null);
  const [blockNumber, setBlockNumber] = useState(null);
  const [networkOk, setNetworkOk] = useState(false);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const [stats, flow, audit, trendData] = await Promise.all([
        apiFetch("/stats"),
        apiFetch("/analytics/flow-24h"),
        apiFetch("/analytics/audit-trail?limit=8"),
        apiFetch("/analytics/trend-summary?days=30"),
      ]);
      setDbStats(stats);
      setFlowBuckets(flow);
      setAuditTrail(audit);
      setTrends(trendData);

      if (window.ethereum) {
        try {
          const contract = await getContract();
          const platform = await contract.getPlatformStats();
          const totalCampaigns = Number(platform[0]);
          setChainStats({
            totalCampaigns,
            totalDonations: formatEth(platform[1]),
            totalStablecoin: formatTokenAmount(platform[2], 6),
            totalFinalized: Number(platform[3]),
            contractBalance: formatEth(platform[4]),
          });

          // Count cancelled campaigns for integrity score
          let cancelled = 0;
          for (let i = 0; i < totalCampaigns; i++) {
            try {
              const ex = await contract.getCampaignExtra(i);
              if (ex[3]) cancelled++;
            } catch { /* ignore */ }
          }
          setCancelledCount(cancelled);

          // Real block number from provider
          try {
            const bn = await getProvider().getBlockNumber();
            setBlockNumber(bn);
            setNetworkOk(true);
          } catch { setNetworkOk(false); }
        } catch (e) {
          console.warn("Could not load chain stats:", e.message);
          setNetworkOk(false);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.hero}>
          <p className={styles.heroSubheading}>TrustChain Integrity</p>
          <h1 className={styles.title}>CELESTIAL LEDGER</h1>
          <p className={styles.subtitle}>Loading transparency data from blockchain...</p>
        </div>
        <SkeletonStats count={4} />
        <div style={{ marginTop: "20px" }}><SkeletonStats count={4} /></div>
      </div>
    );
  }

  /* Compute stats for the bento grid */
  const totalVerified = chainStats ? chainStats.totalFinalized : (dbStats?.totalDonations || 0);
  // Integrity score: % campaigns not cancelled
  const integrityScore = (() => {
    if (!chainStats || chainStats.totalCampaigns === 0) return "—";
    const ok = chainStats.totalCampaigns - cancelledCount;
    return `${((ok / chainStats.totalCampaigns) * 100).toFixed(1)}%`;
  })();
  const globalNodes = dbStats ? dbStats.totalUsers : 0;
  const co2Offset = chainStats
    ? `${(parseFloat(chainStats.totalDonations) * 2.4).toFixed(1)}t`
    : "0t";

  // Real flow chart bars (scale by amount or count)
  const flowTotal = flowBuckets.reduce((s, b) => s + (b.count || 0), 0);
  const flowMax = Math.max(...flowBuckets.map(b => b.amount || b.count || 0), 1);
  const renderFlowBars = () => flowBuckets.map((b, i) => {
    const value = b.amount || b.count || 0;
    const heightPct = value > 0 ? Math.max(8, (value / flowMax) * 100) : 2;
    return (
      <div
        key={i}
        className={styles.chartBar}
        style={{ height: `${heightPct}%`, opacity: value > 0 ? 1 : 0.25 }}
        title={`${new Date(b.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${b.count} txn${b.count !== 1 ? 's' : ''}, ${b.amount.toFixed(4)}`}
      />
    );
  });

  // Trend chips: hide if null delta or zero current
  const renderTrendChip = (trend) => {
    if (!trend) return null;
    const { current, deltaPct } = trend;
    if (deltaPct === null || deltaPct === undefined) {
      return <div className={styles.statTrend}><span>New</span></div>;
    }
    if (current === 0) {
      return <div className={styles.statTrend}><span>No activity 30d</span></div>;
    }
    const up = deltaPct >= 0;
    const cls = up ? `${styles.statTrend} ${styles.statTrendUp}` : styles.statTrend;
    return (
      <div className={cls}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          {up ? "trending_up" : "trending_down"}
        </span>
        <span>{up ? "+" : ""}{deltaPct}%</span>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* ── Hero Header ── */}
      <div className={styles.hero}>
        <p className={styles.heroSubheading}>TrustChain Integrity</p>
        <h1 className={styles.title}>CELESTIAL LEDGER</h1>
        <p className={styles.subtitle}>
          Explore the deep-layer metrics of the TrustChain ecosystem.
          Every transaction, every DAO vote, every payout -- etched immutably on-chain
          and surfaced here for full public accountability.
        </p>
      </div>

      {/* ── Stats Bento Grid ── */}
      <div className={styles.bentoGrid}>
        <div className={styles.statCard}>
          <span className={`material-symbols-outlined ${styles.statIcon}`}>light_mode</span>
          <p className={styles.statLabel}>Total Verified</p>
          <p className={styles.statValue}>{totalVerified}</p>
          {renderTrendChip(trends?.donationCount)}
        </div>
        <div className={styles.statCard}>
          <span className={`material-symbols-outlined ${styles.statIcon}`}>verified_user</span>
          <p className={styles.statLabel}>Integrity Score</p>
          <p className={styles.statValue}>{integrityScore}</p>
          <div className={styles.statTrend}>
            <span>
              {!chainStats || chainStats.totalCampaigns === 0
                ? "No campaigns yet"
                : cancelledCount === 0
                  ? "All campaigns active"
                  : `${chainStats.totalCampaigns - cancelledCount} of ${chainStats.totalCampaigns} active`}
            </span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`material-symbols-outlined ${styles.statIcon}`}>hub</span>
          <p className={styles.statLabel}>Global Nodes</p>
          <p className={styles.statValue}>{globalNodes}</p>
          {renderTrendChip(trends?.users)}
        </div>
        <div className={styles.statCard}>
          <span className={`material-symbols-outlined ${styles.statIcon}`}>co2</span>
          <p className={styles.statLabel}>CO2 Offset</p>
          <p className={styles.statValue}>{co2Offset}</p>
          <div className={styles.statTrend}>
            <span>Estimated</span>
          </div>
        </div>
      </div>

      {/* ── Main Grid: Left (Flow + Network) / Right (Audit Trail) ── */}
      <div className={styles.mainGrid}>
        <div className={styles.leftColumn}>
          {/* ── Transparency Flow Chart ── */}
          <div className={styles.flowPanel}>
            <div className={styles.flowHeader}>
              <span className={styles.flowTitle}>Transparency Flow</span>
              <span className={styles.flowBadge}>24H</span>
              <span className={styles.flowBadgeLive}>Live Stream</span>
            </div>
            <div className={styles.chartArea}>
              <div className={styles.gridLine} style={{ bottom: "25%" }} />
              <div className={styles.gridLine} style={{ bottom: "50%" }} />
              <div className={styles.gridLine} style={{ bottom: "75%" }} />
              {renderFlowBars()}
              {flowTotal === 0 && (
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: "var(--sn-on-surface-variant, #E4BEB1)",
                  fontSize: "0.75rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", opacity: 0.6,
                  pointerEvents: "none"
                }}>
                  No donation activity in the last 24 hours
                </div>
              )}
            </div>
          </div>

          {/* ── Network Health + Block Sync ── */}
          <div className={styles.subGrid}>
            <div className={styles.networkPanel}>
              <p className={styles.networkTitle}>Network Health</p>
              <div className={styles.ringContainer}>
                <div className={styles.ring} />
                <span className={styles.ringLabel}>{networkOk ? "100%" : "0%"}</span>
              </div>
              <div className={styles.statusList}>
                <div className={styles.statusItem}>
                  <span className={networkOk ? styles.statusDotGreen : styles.statusDotOrange} />
                  <span>{networkOk ? "Consensus Active" : "Disconnected"}</span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusDotOrange} />
                  <span>Active Campaigns: {chainStats ? chainStats.totalCampaigns - cancelledCount : 0}</span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusDotBlue} />
                  <span>Registered Users: {globalNodes}</span>
                </div>
              </div>
            </div>

            <div className={styles.blockPanel}>
              <p className={styles.networkTitle}>Block Sync</p>
              <div>
                <p className={styles.blockNumber}>
                  #{blockNumber !== null ? blockNumber.toLocaleString() : "—"}
                </p>
                <p className={styles.blockLabel}>Latest Block</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Audit Trail Timeline ── */}
        <div className={styles.auditPanel}>
          <div className={styles.auditHeader}>
            <span className={`material-symbols-outlined ${styles.auditIcon}`}>history</span>
            <span className={styles.auditTitle}>Audit Trail</span>
          </div>
          <div className={styles.timeline}>
            {auditTrail.length === 0 ? (
              <p className={styles.timelineDesc} style={{ opacity: 0.6, padding: "1rem 0" }}>
                No on-chain activity yet.
              </p>
            ) : auditTrail.map((item, i) => (
              <div key={i} className={styles.timelineItem}>
                <p className={styles.timelineTime}>{formatRelativeTime(item.at)}</p>
                <p className={styles.timelineDesc}>{item.desc}</p>
                <span className={styles.timelineHash}>
                  {shortenHash(item.hash)}
                  {item.hash && (
                    <a
                      href={`https://amoy.polygonscan.com/tx/${item.hash}`}
                      target="_blank" rel="noreferrer"
                      className={styles.timelineLedgerLink}
                    >
                      View on Ledger
                    </a>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── On-Chain Stats (from smart contract) ── */}
      {chainStats && (
        <div className={styles.bentoGrid}>
          <div className={styles.statCard}>
            <span className={`material-symbols-outlined ${styles.statIcon}`}>token</span>
            <p className={styles.statLabel}>ETH Donated (On-Chain)</p>
            <p className={styles.statValue}>{chainStats.totalDonations} ETH</p>
          </div>
          <div className={styles.statCard}>
            <span className={`material-symbols-outlined ${styles.statIcon}`}>campaign</span>
            <p className={styles.statLabel}>Active Campaigns</p>
            <p className={styles.statValue}>{chainStats.totalCampaigns}</p>
          </div>
          <div className={styles.statCard}>
            <span className={`material-symbols-outlined ${styles.statIcon}`}>check_circle</span>
            <p className={styles.statLabel}>Verified Payouts</p>
            <p className={styles.statValue}>{chainStats.totalFinalized}</p>
          </div>
          <div className={styles.statCard}>
            <span className={`material-symbols-outlined ${styles.statIcon}`}>account_balance</span>
            <p className={styles.statLabel}>Held in Contract</p>
            <p className={styles.statValue}>{chainStats.contractBalance} ETH</p>
          </div>
        </div>
      )}

      {/* ── Database Stats ── */}
      {dbStats && (
        <>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Global Distribution</h2>
              <p className={styles.sectionSubtitle}>Network nodes and community members.</p>
            </div>
          </div>
          <div className={styles.bentoGrid}>
            <div className={styles.statCard}>
              <span className={`material-symbols-outlined ${styles.statIcon}`}>group</span>
              <p className={styles.statLabel}>Total Users</p>
              <p className={styles.statValue}>{dbStats.totalUsers}</p>
            </div>
            <div className={styles.statCard}>
              <span className={`material-symbols-outlined ${styles.statIcon}`}>verified</span>
              <p className={styles.statLabel}>Verified Charities</p>
              <p className={styles.statValue}>{dbStats.totalCharities}</p>
            </div>
            <div className={styles.statCard}>
              <span className={`material-symbols-outlined ${styles.statIcon}`}>receipt_long</span>
              <p className={styles.statLabel}>Total Transactions</p>
              <p className={styles.statValue}>{dbStats.totalDonations}</p>
            </div>
            <div className={styles.statCard}>
              <span className={`material-symbols-outlined ${styles.statIcon}`}>attach_money</span>
              <p className={styles.statLabel}>Stablecoin Volume</p>
              <p className={styles.statValue}>
                {chainStats ? chainStats.totalStablecoin : "0"}
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Feature Cards ── */}
      <div className={styles.featureGrid}>
        <div className={styles.featureCard}>
          <span className={`material-symbols-outlined ${styles.featureIcon}`}>lock</span>
          <h4 className={styles.featureTitle}>Immutable Records</h4>
          <p className={styles.featureText}>
            Every donation is permanently recorded on the blockchain. No one can alter or delete transaction history.
          </p>
        </div>
        <div className={styles.featureCard}>
          <span className={`material-symbols-outlined ${styles.featureIcon}`}>how_to_vote</span>
          <h4 className={styles.featureTitle}>DAO Governance</h4>
          <p className={styles.featureText}>
            Charities cannot spend unilaterally. Donors vote on every spending request -- majority approval required.
          </p>
        </div>
        <div className={styles.featureCard}>
          <span className={`material-symbols-outlined ${styles.featureIcon}`}>visibility</span>
          <h4 className={styles.featureTitle}>Full Visibility</h4>
          <p className={styles.featureText}>
            Track exactly how much was raised, how much was spent, and where every ETH went -- in real time.
          </p>
        </div>
        <div className={styles.featureCard}>
          <span className={`material-symbols-outlined ${styles.featureIcon}`}>timer</span>
          <h4 className={styles.featureTitle}>Smart Contract Vesting</h4>
          <p className={styles.featureText}>
            Funds are held in code, not bank accounts. Smart contracts enforce accountability automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
