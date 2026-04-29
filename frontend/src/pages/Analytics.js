import { useState, useEffect } from "react";
import { apiFetch, getContract, formatEth, formatTokenAmount } from "../utils/ethereum";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from "recharts";
import { SkeletonStats, Skeleton } from "../components/Skeleton";
import styles from "./Analytics.module.css";

const PIE_COLORS = ["#FF5C00", "#FFB59A", "#5B4137", "#FFB955", "#E4BEB1", "#2A2A2A", "#353534", "#1C1B1B"];

const CATEGORY_COLORS = {
  Medical: "#FF5C00", Education: "#FFB59A", Transport: "#FFB955",
  Admin: "#5B4137", Infrastructure: "#E4BEB1", Staffing: "#FF5C00",
  Equipment: "#FFB955", Other: "#5B4137",
  Healthcare: "#FF5C00", Environment: "#FFB59A", "Disaster Relief": "#FFB955",
  Poverty: "#E4BEB1", Animals: "#FF5C00", General: "#5B4137",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#0E0E0E",
  border: "1px solid #5B4137",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#E5E2E1",
};

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [donationsOverTime, setDonationsOverTime] = useState([]);
  const [campaignsByCategory, setCampaignsByCategory] = useState([]);
  const [chainStats, setChainStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [geoData, setGeoData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [statsData, timeData, catData, trendData, geo] = await Promise.all([
        apiFetch("/stats"),
        apiFetch("/analytics/donations-over-time"),
        apiFetch("/analytics/by-category"),
        apiFetch("/analytics/trend-summary?days=30"),
        apiFetch("/analytics/geo"),
      ]);
      setTrends(trendData);
      setGeoData(geo || []);

      setStats(statsData);
      setDonationsOverTime(timeData);
      setCampaignsByCategory(catData.map(c => ({
        name: c._id || "Uncategorised",
        value: c.count,
        color: CATEGORY_COLORS[c._id] || "#5B4137"
      })));

      if (window.ethereum) {
        try {
          const contract = await getContract();
          const platform = await contract.getPlatformStats();
          setChainStats({
            totalCampaigns: Number(platform[0]),
            totalETH: formatEth(platform[1]),
            totalStablecoin: formatTokenAmount(platform[2], 6),
            totalFinalized: Number(platform[3]),
            contractBalance: formatEth(platform[4]),
          });
        } catch (e) { console.warn("Could not load chain stats:", e.message); }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const spendingPieData = stats?.spendingByCategory?.map(item => ({
    name: item._id || "Other",
    value: parseFloat(item.total.toFixed(4)),
    count: item.count,
    color: CATEGORY_COLORS[item._id] || "#5B4137"
  })) || [];

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Impact Analytics</h1>
          <p className={styles.pageSubtitle}>Loading analytics data...</p>
        </div>
        <SkeletonStats count={4} />
        <div className={styles.chartsGrid} style={{ marginTop: "20px" }}>
          <div className={styles.chartPanel}><Skeleton height="260px" /></div>
          <div className={styles.chartPanel}><Skeleton height="260px" /></div>
        </div>
      </div>
    );
  }

  const totalDonationsCount = stats?.totalDonations || 0;
  const activeNodes = stats?.totalUsers || 0;
  const valueLocked = chainStats ? `${chainStats.contractBalance} ETH` : "---";
  const impactProjects = chainStats ? chainStats.totalCampaigns : (stats?.totalCampaigns || 0);

  // Real trend chip — hide when delta is null (no baseline) or current=0
  const TrendChip = ({ trend }) => {
    if (!trend) return null;
    const { current, deltaPct } = trend;
    if (deltaPct === null || deltaPct === undefined) {
      return <div className={`${styles.metricTrend} ${styles.trendNeutral}`}><span>New</span></div>;
    }
    if (current === 0) {
      return <div className={`${styles.metricTrend} ${styles.trendNeutral}`}><span>No activity 30d</span></div>;
    }
    const up = deltaPct >= 0;
    const cls = `${styles.metricTrend} ${up ? styles.trendUp : ""}`;
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
      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Impact Analytics</h1>
        <p className={styles.pageSubtitle}>
          Data-driven insights from on-chain and off-chain records. Addressing the Charity Commission's
          finding that financial transparency is the #1 driver of public trust in charities.
        </p>
      </div>

      {/* ── Metrics Grid ── */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Total Donations</p>
          <span className={`material-symbols-outlined ${styles.metricIcon}`}>volunteer_activism</span>
          <p className={styles.metricValue}>
            {chainStats ? `${chainStats.totalETH} ETH` : totalDonationsCount}
          </p>
          <TrendChip trend={trends?.donationAmount} />
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Active Nodes</p>
          <span className={`material-symbols-outlined ${styles.metricIcon}`}>hub</span>
          <p className={styles.metricValue}>{activeNodes}</p>
          <TrendChip trend={trends?.users} />
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Value Locked</p>
          <span className={`material-symbols-outlined ${styles.metricIcon}`}>lock</span>
          <p className={styles.metricValue}>{valueLocked}</p>
          <div className={`${styles.metricTrend} ${styles.trendNeutral}`}>
            <span>Secured</span>
          </div>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>Impact Projects</p>
          <span className={`material-symbols-outlined ${styles.metricIcon}`}>eco</span>
          <p className={styles.metricValue}>{impactProjects}</p>
          <TrendChip trend={trends?.campaigns} />
        </div>
      </div>

      {/* ── On-Chain Stats Row ── */}
      {chainStats && (
        <div className={styles.metricsGrid} style={{ marginBottom: 48 }}>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>On-Chain Campaigns</p>
            <span className={`material-symbols-outlined ${styles.metricIcon}`}>campaign</span>
            <p className={styles.metricValue}>{chainStats.totalCampaigns}</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Stablecoin Volume</p>
            <span className={`material-symbols-outlined ${styles.metricIcon}`}>paid</span>
            <p className={styles.metricValue}>{chainStats.totalStablecoin}</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Approved Releases</p>
            <span className={`material-symbols-outlined ${styles.metricIcon}`}>check_circle</span>
            <p className={styles.metricValue}>{chainStats.totalFinalized}</p>
          </div>
          <div className={styles.metricCard}>
            <p className={styles.metricLabel}>Contract Balance</p>
            <span className={`material-symbols-outlined ${styles.metricIcon}`}>account_balance</span>
            <p className={styles.metricValue}>{chainStats.contractBalance} ETH</p>
          </div>
        </div>
      )}

      {/* ── Charts: Donation Velocity + Fund Allocation ── */}
      <div className={styles.chartsGrid}>
        {/* Donation Velocity (Area Chart) */}
        <div className={styles.chartPanel}>
          <div className={styles.chartHeader}>
            <span className={`material-symbols-outlined ${styles.chartIcon}`}>show_chart</span>
            <span className={styles.chartTitle}>Donation Velocity</span>
          </div>
          <p className={styles.chartDesc}>Tracks donation volume over time</p>
          {donationsOverTime.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No donation data yet. Make some donations to see trends.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={donationsOverTime}>
                <defs>
                  <linearGradient id="snAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5C00" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF5C00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#5B4137" strokeOpacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5B4137" }} axisLine={{ stroke: "#5B4137", strokeOpacity: 0.2 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#5B4137" }} axisLine={{ stroke: "#5B4137", strokeOpacity: 0.2 }} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [
                    name === "amount" ? `${value} ETH` : value,
                    name === "amount" ? "Total Donated" : "Transactions"
                  ]}
                />
                <Area type="monotone" dataKey="amount" stroke="#FF5C00" strokeWidth={2}
                  fill="url(#snAreaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fund Allocation (Donut) */}
        <div className={styles.chartPanel}>
          <div className={styles.chartHeader}>
            <span className={`material-symbols-outlined ${styles.chartIcon}`}>donut_large</span>
            <span className={styles.chartTitle}>Fund Allocation</span>
          </div>
          <p className={styles.chartDesc}>Distribution across cause areas</p>
          {campaignsByCategory.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No campaigns yet.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={campaignsByCategory}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {campaignsByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${value} campaign${value !== 1 ? "s" : ""}`, "Count"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {campaignsByCategory.map((entry, i) => (
                  <div key={i} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: entry.color || PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span>{entry.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Spending Allocation ── */}
      <div className={styles.spendingSection}>
        <div className={styles.chartPanel}>
          <div className={styles.chartHeader}>
            <span className={`material-symbols-outlined ${styles.chartIcon}`}>payments</span>
            <span className={styles.chartTitle}>Spending Allocation by Category</span>
          </div>
          <p className={styles.chartDesc}>
            How approved spending requests are distributed -- directly addresses the 30-point trust gap
            identified in Charity Commission research (87% want to know where money goes, only 57% feel they can see it).
          </p>
          {spendingPieData.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No spending requests recorded yet. Create and approve some to see allocation data.</p>
            </div>
          ) : (
            <div className={styles.spendingLayout}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={spendingPieData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {spendingPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${value} ETH`, "Amount"]}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className={styles.categoryList}>
                {spendingPieData.map((item, i) => {
                  const total = spendingPieData.reduce((s, d) => s + d.value, 0);
                  const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} className={styles.categoryItem}>
                      <span className={styles.categoryDot} style={{ background: item.color }} />
                      <div className={styles.categoryInfo}>
                        <div className={styles.categoryName}>{item.name}</div>
                        <div className={styles.categoryCount}>{item.count} request{item.count !== 1 ? "s" : ""}</div>
                      </div>
                      <div className={styles.categoryValues}>
                        <div className={styles.categoryAmount} style={{ color: item.color }}>{item.value} ETH</div>
                        <div className={styles.categoryPercent}>{pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction Count Bar Chart ── */}
      {donationsOverTime.length > 0 && (
        <div className={styles.barSection}>
          <div className={styles.chartPanel}>
            <div className={styles.chartHeader}>
              <span className={`material-symbols-outlined ${styles.chartIcon}`}>bar_chart</span>
              <span className={styles.chartTitle}>Transaction Count</span>
            </div>
            <p className={styles.chartDesc}>Number of individual donations per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={donationsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#5B4137" strokeOpacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#5B4137" }} axisLine={{ stroke: "#5B4137", strokeOpacity: 0.2 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#5B4137" }} axisLine={{ stroke: "#5B4137", strokeOpacity: 0.2 }} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [`${value} donation${value !== 1 ? "s" : ""}`, "Count"]}
                />
                <Bar dataKey="count" fill="#FF5C00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Geographic Distribution ── */}
      <div className={styles.barSection}>
        <div className={styles.chartPanel}>
          <div className={styles.chartHeader}>
            <span className={`material-symbols-outlined ${styles.chartIcon}`}>public</span>
            <span className={styles.chartTitle}>Donor Geographic Distribution</span>
          </div>
          <p className={styles.chartDesc}>Auto-detected via ip-api.com on each donation. Shows where donors back campaigns from.</p>
          {geoData.length === 0 ? (
            <p style={{ padding: "1.5rem 0", color: "var(--sn-on-surface-variant, #E4BEB1)", opacity: 0.6, fontSize: "0.875rem" }}>
              No country data yet. Will populate as donors contribute.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, geoData.length * 36)}>
              <BarChart data={geoData} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#5B4137" strokeOpacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#5B4137" }} axisLine={{ stroke: "#5B4137", strokeOpacity: 0.2 }} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 11, fill: "#E4BEB1" }} axisLine={{ stroke: "#5B4137", strokeOpacity: 0.2 }} tickLine={false} width={110} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [`${value} donation${value !== 1 ? "s" : ""}`, "Count"]}
                />
                <Bar dataKey="count" fill="#FFB59A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Research Context ── */}
      <div className={styles.researchPanel}>
        <h3 className={styles.researchTitle}>Why This Data Matters</h3>
        <div className={styles.researchGrid}>
          <div className={styles.researchItem}>
            <span className={styles.researchHighlight}>Charity Commission (2024):</span> 87% of the public
            say knowing where money is spent is important for trust, yet only 57% feel charities deliver this.
            This 30-point gap is the single largest trust deficit in the sector.
          </div>
          <div className={styles.researchItem}>
            <span className={styles.researchHighlightSecondary}>CAF UK Giving (2025):</span> Only 50% of people donated
            in 2024 -- an all-time low. 19% of non-donors cite lack of trust. The 15.4 billion donated came from
            a shrinking donor base giving more per person.
          </div>
          <div className={styles.researchItem}>
            <span className={styles.researchHighlightAccent}>This Platform:</span> Blockchain-verified spending allocation,
            DAO governance for fund release, and stablecoin support address all three pillars:
            transparency, affordability, and value stability.
          </div>
        </div>
      </div>
    </div>
  );
}
