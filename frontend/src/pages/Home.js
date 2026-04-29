import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { getContract, getSigner, getContractAddr, apiFetch, apiPost, formatEth, formatTokenAmount, getEthUsdPrice, stablecoinToEth, getEthFiatRates, API_URL } from "../utils/ethereum";
import { getCampaignStatus } from "../utils/campaignHelpers";
import { useToast } from "../components/Toast";
import { SkeletonCard } from "../components/Skeleton";
import styles from "./Home.module.css";

const CATEGORIES = ["All", "General", "Healthcare", "Education", "Environment", "Disaster Relief", "Poverty", "Animals"];

// Minimal ERC-20 ABI for approve + decimals
const IERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function balanceOf(address account) external view returns (uint256)"
];

const STATUS_CLASS_MAP = {
  active: "statusActive",
  funded: "statusFunded",
  expired: "statusExpired",
  cancelled: "statusCancelled",
  completed: "statusCompleted",
};

export default function Home({ user }) {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [chainData, setChainData] = useState({});
  const [donationAmounts, setDonationAmounts] = useState({});
  const [donationCurrency] = useState({});
  const [donatingId, setDonatingId] = useState(null); // eslint-disable-line no-unused-vars
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [platformStats, setPlatformStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickerData, setTickerData] = useState({ eth: null, btc: null });
  const [ethUsdPrice, setEthUsdPrice] = useState(null);
  const [ethFiat, setEthFiat] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadCampaigns(); loadPlatformStats();
    getEthUsdPrice().then(setEthUsdPrice);
    getEthFiatRates().then(setEthFiat);
    // Try to fetch live ETH/GBP rate
    // Fetch ticker data for ETH + BTC
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=gbp,usd&include_24hr_change=true')
      .then(r => r.json())
      .then(data => {
        setTickerData({
          eth: data?.ethereum ? { price: data.ethereum.gbp, usd: data.ethereum.usd, change: data.ethereum.usd_24h_change } : null,
          btc: data?.bitcoin ? { price: data.bitcoin.gbp, usd: data.bitcoin.usd, change: data.bitcoin.usd_24h_change } : null,
        });
      })
      .catch(e => console.warn('Ticker fetch failed:', e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlatformStats = async () => {
    try { setPlatformStats(await apiFetch("/stats")); } catch (e) { console.warn('Stats unavailable:', e.message); }
  };

  const loadCampaigns = async () => {
    try {
      const res = await apiFetch("/campaigns");
      const data = res.campaigns || res; // Support paginated response
      setCampaigns(data);
      if (window.ethereum) {
        try {
          const contract = await getContract();
          const onChain = {};
          const results = await Promise.allSettled(data.map(async (c) => {
            const [summary, extra] = await Promise.all([
              contract.getSummary(c.smartContractId),
              contract.getCampaignExtra(c.smartContractId)
            ]);
            return { id: c.smartContractId, summary, extra };
          }));
          results.forEach(r => {
            if (r.status === 'fulfilled') {
              const { id: scId, summary, extra } = r.value;
              onChain[scId] = {
                minContribution: formatEth(summary[0]),
                raisedAmount: formatEth(summary[1]),
                raisedAmountRaw: summary[1].toString(),
                numRequests: Number(summary[2]),
                approversCount: Number(summary[3]),
                manager: summary[4],
                name: summary[5],
                target: formatEth(summary[6]),
                targetRaw: summary[6].toString(),
                totalDisbursed: formatEth(summary[7]),
                totalDisbursedRaw: summary[7].toString(),
                stablecoinRaised: formatTokenAmount(extra[0], 6),
                stablecoinRaisedRaw: extra[0].toString(),
                stablecoinDisbursed: formatTokenAmount(extra[1], 6),
                deadline: Number(extra[2]),
                cancelled: extra[3],
              };
            }
          });
          setChainData(onChain);
        } catch (e) { console.info('MetaMask not connected'); }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Fixed donate function with role check + stablecoin ERC-20 flow
  const donate = async (campaign) => {
    if (!user) return navigate("/login");
    if (user.role !== "donor") return toast.error("Only donors can contribute");

    const amount = donationAmounts[campaign._id];
    const currency = donationCurrency[campaign._id] || "ETH";
    if (!amount || parseFloat(amount) <= 0) return toast.warning("Enter a valid donation amount");

    setDonatingId(campaign._id);
    try {
      const contract = await getContract();
      let receipt;

      if (currency === "ETH") {
        const tx = await contract.donate(campaign.smartContractId, {
          value: ethers.parseEther(amount),
        });
        receipt = await tx.wait();
      } else {
        // ERC-20 stablecoin flow: approve then donateStablecoin
        const stablecoinAddr = await contract.stablecoinAddress();
        if (stablecoinAddr === ethers.ZeroAddress) {
          toast.error("Stablecoin not configured on this contract");
          return;
        }
        const signer = await getSigner();
        const tokenContract = new ethers.Contract(stablecoinAddr, IERC20_ABI, signer);

        // Get decimals (USDT/USDC = 6, DAI = 18)
        let decimals = 6;
        try { decimals = Number(await tokenContract.decimals()); } catch { /* default 6 */ }
        const parsedAmount = ethers.parseUnits(amount, decimals);

        // Step 1: Approve contract to spend tokens
        toast.info("Approving token spend...");
        const contractAddress = getContractAddr();
        const approveTx = await tokenContract.approve(contractAddress, parsedAmount);
        await approveTx.wait();
        toast.info("Approval confirmed. Sending donation...");

        // Step 2: Call donateStablecoin on the charity contract
        const tx = await contract.donateStablecoin(campaign.smartContractId, parsedAmount);
        receipt = await tx.wait();
      }

      await apiPost("/donations", {
        campaignId: campaign.smartContractId,
        donorWallet: user.walletAddress.toLowerCase(),
        amount: amount, currency: currency,
        txHash: receipt.hash, donorName: user.fullName,
      });

      toast.success(`Donated ${amount} ${currency} successfully! You can now vote on spending.`);
      setDonationAmounts({ ...donationAmounts, [campaign._id]: "" });
      loadCampaigns();
      loadPlatformStats();
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed: " + (err.reason || err.message));
    } finally {
      setDonatingId(null);
    }
  };

  const filtered = campaigns.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || c.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const isDonorOrGuest = !user || user.role === "donor";

  const formatTickerPrice = (price) => {
    if (!price) return "--";
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(price);
  };

  const formatTickerChange = (change) => {
    if (change == null) return null;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className={styles.homeContainer}>
      {/* ── Hero Section ── */}
      <div className={styles.heroSection}>
        <div className={styles.pulseOrb}></div>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Transparent Giving,<br />
            <span className={styles.heroTitleHighlight}>Powered by Blockchain</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Every donation tracked on an immutable ledger. DAO governance gives donors a direct voice in how funds are spent.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.btnPrimary} onClick={() => {
              document.getElementById("campaigns-section")?.scrollIntoView({ behavior: "smooth" });
            }}>
              Start Giving
            </button>
            <Link to="/transparency" className={styles.btnGlass}>
              View Network Status
            </Link>
          </div>
        </div>
      </div>

      {/* ── Price Ticker ── */}
      <div className={styles.tickerSection}>
        <div className={styles.tickerCard}>
          <div className={styles.tickerIcon}>
            <span className="material-symbols-outlined">currency_exchange</span>
          </div>
          <div className={styles.tickerInfo}>
            <span className={styles.tickerLabel}>Ethereum (ETH)</span>
            <span className={styles.tickerPrice}>{formatTickerPrice(tickerData.eth?.price)}</span>
            {tickerData.eth?.usd != null && (
              <span className={styles.tickerUsd}>${tickerData.eth.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD</span>
            )}
            {tickerData.eth?.change != null && (
              <span className={`${styles.tickerChange} ${tickerData.eth.change >= 0 ? styles.tickerUp : styles.tickerDown}`}>
                {formatTickerChange(tickerData.eth.change)} 24h
              </span>
            )}
          </div>
        </div>
        <div className={styles.tickerCard}>
          <div className={styles.tickerIcon}>
            <span className="material-symbols-outlined">currency_bitcoin</span>
          </div>
          <div className={styles.tickerInfo}>
            <span className={styles.tickerLabel}>Bitcoin (BTC)</span>
            <span className={styles.tickerPrice}>{formatTickerPrice(tickerData.btc?.price)}</span>
            {tickerData.btc?.usd != null && (
              <span className={styles.tickerUsd}>${tickerData.btc.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD</span>
            )}
            {tickerData.btc?.change != null && (
              <span className={`${styles.tickerChange} ${tickerData.btc.change >= 0 ? styles.tickerUp : styles.tickerDown}`}>
                {formatTickerChange(tickerData.btc.change)} 24h
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Panel ── */}
      {platformStats && (
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Campaigns</div>
              <div className={styles.statValue}>{platformStats.totalCampaigns}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Total Donated</div>
              <div className={styles.statValue}>
                {platformStats.totalETH} <span className={styles.statCurrency}>ETH</span>
              </div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Active Donors</div>
              <div className={styles.statValue}>{platformStats.totalDonors}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Charities</div>
              <div className={styles.statValue}>{platformStats.totalCharities}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Filter ── */}
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input
              className={styles.searchInput}
              placeholder="Search campaigns, causes, or charities..."
              aria-label="Search campaigns"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filterWrapper}>
            {CATEGORIES.slice(0, 5).map((cat) => (
              <button
                key={cat}
                className={`${styles.filterBtn} ${categoryFilter === cat ? styles.filterBtnActive : ''}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "All" ? "All Causes" : cat}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.resultCount}>
          Showing {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Campaigns Section ── */}
      <div className={styles.campaignsSection} id="campaigns-section">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Active Campaigns</h2>
            <p className={styles.sectionSubtitle}>Vetted by the TrustChain community</p>
          </div>
          <button className={styles.viewAll}>
            View All
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className={styles.grid}>
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <h3>No campaigns found</h3>
            <p>{campaigns.length === 0 ? "Charities can create campaigns from the Dashboard." : "Try adjusting your search or filter."}</p>
          </div>
        )}

        {/* ── Campaign Cards ── */}
        {!loading && (
          <div className={styles.grid}>
            {filtered.map((c) => {
              const chain = chainData[c.smartContractId];
              const status = getCampaignStatus(chain);
              const isExpired = chain?.deadline > 0 && Date.now() / 1000 > chain.deadline;
              const canDonate = isDonorOrGuest && !chain?.cancelled && !isExpired && status?.key !== "completed" && status?.key !== "funded";

              const raisedEth = chain ? parseFloat(chain.raisedAmount) : 0;
              const stableRaised = chain ? parseFloat(chain.stablecoinRaised || 0) : 0;
              const stableInEth = ethUsdPrice ? stablecoinToEth(stableRaised, ethUsdPrice) : 0;
              const raised = raisedEth + stableInEth;
              const goal = parseFloat(c.goal);
              const percent = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 100) : 0;

              const statusStyleKey = status?.key ? STATUS_CLASS_MAP[status.key] : null;

              return (
                <div key={c._id} className={styles.campaignCard} onClick={() => navigate(`/campaign/${c.smartContractId}`)}>
                  <div className={styles.cardImageWrapper}>
                    <img
                      src={c.imageUrl?.startsWith('/uploads') ? `${API_URL}${c.imageUrl}` : c.imageUrl || `https://placehold.co/600x300/0E0E0E/FFB59A?text=${encodeURIComponent(c.title)}&font=Space+Grotesk`}
                      className={styles.cardImage} alt={c.title}
                    />
                    <div className={styles.cardImageOverlay}></div>
                    {status && (
                      <div className={`${styles.statusBadge} ${statusStyleKey ? styles[statusStyleKey] : styles.statusActive}`}>
                        {status.label}
                      </div>
                    )}
                    <div className={styles.verifiedBadge}>
                      <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                      Verified
                    </div>
                  </div>

                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>{c.title}</h3>
                    <p className={styles.cardDescription}>
                      {c.description ? c.description.substring(0, 120) + (c.description.length > 120 ? "..." : "") : "No description provided."}
                    </p>

                    <div className={styles.progressSection}>
                      <div className={styles.progressHeader}>
                        <span className={styles.progressRaised}>{raised.toFixed(4)} ETH</span>
                        <span className={styles.progressGoal}>of {goal} ETH goal</span>
                      </div>
                      {ethFiat && (
                        <div className={styles.fiatLine}>
                          {ethFiat.gbp ? `£${(goal * ethFiat.gbp).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                          {ethFiat.usd ? ` · $${(goal * ethFiat.usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                          {ethFiat.eur ? ` · €${(goal * ethFiat.eur).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                        </div>
                      )}
                      {stableRaised > 0 && (
                        <div className={styles.stableNote}>incl. {stableRaised.toFixed(2)} mUSDT ({stableInEth.toFixed(4)} ETH equiv.)</div>
                      )}
                      <div className={styles.progressTrack}>
                        <div
                          className={`${styles.progressFill} ${percent >= 100 ? styles.progressFillComplete : ''}`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className={styles.cardFooter} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.backersInfo}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-text-dim)' }}>group</span>
                        <span className={styles.backerCount}>{chain?.approversCount || 0} backers</span>
                      </div>

                      {canDonate ? (
                        <button
                          className={styles.contributeBtn}
                          onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${c.smartContractId}`); }}
                        >
                          Contribute
                        </button>
                      ) : (
                        <span className={styles.closedLabel}>
                          {isExpired && !chain?.cancelled ? "Ended" : "Closed"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
