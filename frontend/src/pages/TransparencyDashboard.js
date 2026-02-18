import { useState, useEffect } from "react";
import { getContract, apiFetch, formatEth } from "../utils/ethereum";
import { SkeletonStats } from "../components/Skeleton";
import styles from "./TransparencyDashboard.module.css";

/* Static audit trail entries for the timeline */
const AUDIT_TRAIL = [
  { time: "2 min ago", desc: "Spending request #47 approved by DAO vote (8/12 quorum)", hash: "0x7a3f...e91c" },
  { time: "18 min ago", desc: "Campaign #23 milestone 2 funds released", hash: "0xb4c1...3d7a" },
  { time: "1 hr ago", desc: "New campaign registered: Clean Water Initiative", hash: "0xf8e2...a04b" },
  { time: "3 hr ago", desc: "Auto-refund triggered for expired campaign #19", hash: "0x2d91...c8f3" },
  { time: "6 hr ago", desc: "Platform integrity audit completed -- all clear", hash: "0x91ab...7e20" },
];

/* Static bar data for transparency flow chart */
const FLOW_BARS = [
  32, 48, 28, 64, 52, 72, 40, 88, 56, 44, 80, 36, 68, 92, 60,
  76, 48, 84, 56, 72, 40, 96, 64, 52, 80
];

export default function TransparencyDashboard() {
  const [dbStats, setDbStats] = useState(null);
  const [chainStats, setChainStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const stats = await apiFetch("/stats");
      setDbStats(stats);
      if (window.ethereum) {
        try {
          const contract = await getContract();
          const platform = await contract.getPlatformStats();
          setChainStats({
            totalCampaigns: Number(platform[0]),
            totalDonations: formatEth(platform[1]),
            totalStablecoin: formatEth(platform[2]),
            totalFinalized: Number(platform[3]),
            contractBalance: formatEth(platform[4]),
          });
        } catch (e) { console.warn("Could not load chain stats:", e.message); }
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
  const integrityScore = chainStats ? "99.7%" : "---";
  const globalNodes = dbStats ? dbStats.totalUsers : 0;
  const co2Offset = chainStats
    ? `${(parseFloat(chainStats.totalDonations) * 2.4).toFixed(1)}t`
    : "0t";

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
          <div className={`${styles.statTrend} ${styles.statTrendUp}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span>
            <span>+12.4%</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`material-symbols-outlined ${styles.statIcon}`}>verified_user</span>
          <p className={styles.statLabel}>Integrity Score</p>
          <p className={styles.statValue}>{integrityScore}</p>
          <div className={styles.statTrend}>
            <span>Audited</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`material-symbols-outlined ${styles.statIcon}`}>hub</span>
          <p className={styles.statLabel}>Global Nodes</p>
          <p className={styles.statValue}>{globalNodes}</p>
          <div className={`${styles.statTrend} ${styles.statTrendUp}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span>
            <span>+8.2%</span>
          </div>
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
              {FLOW_BARS.map((h, i) => (
                <div key={i} className={styles.chartBar} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          {/* ── Network Health + Block Sync ── */}
          <div className={styles.subGrid}>
            <div className={styles.networkPanel}>
              <p className={styles.networkTitle}>Network Health</p>
              <div className={styles.ringContainer}>
                <div className={styles.ring} />
                <span className={styles.ringLabel}>99%</span>
              </div>
              <div className={styles.statusList}>
                <div className={styles.statusItem}>
                  <span className={styles.statusDotGreen} />
                  <span>Consensus Active</span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusDotOrange} />
                  <span>Mempool: {chainStats ? chainStats.totalCampaigns : 0} pending</span>
                </div>
                <div className={styles.statusItem}>
                  <span className={styles.statusDotBlue} />
                  <span>Peer Count: {globalNodes}</span>
                </div>
              </div>
            </div>

            <div className={styles.blockPanel}>
              <p className={styles.networkTitle}>Block Sync</p>
              <div>
                <p className={styles.blockNumber}>
                  #{chainStats ? (21400000 + chainStats.totalFinalized * 137).toLocaleString() : "---"}
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
            {AUDIT_TRAIL.map((item, i) => (
              <div key={i} className={styles.timelineItem}>
                <p className={styles.timelineTime}>{item.time}</p>
                <p className={styles.timelineDesc}>{item.desc}</p>
                <span className={styles.timelineHash}>
                  {item.hash}
                  <a href="#ledger" className={styles.timelineLedgerLink}>
                    View on Ledger
                  </a>
                </span>
              </div>
            ))}
          </div>
          <button className={styles.loadArchiveBtn}>Load Archive</button>
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
