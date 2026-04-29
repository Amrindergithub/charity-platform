import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import { getContract, getSigner, getContractAddr, apiFetch, apiPost, formatEth, formatTokenAmount, getEthUsdPrice, stablecoinToEth, shortenAddress, API_URL, aiAnalyzeRequest } from "../utils/ethereum";
import { getCampaignStatus } from "../utils/campaignHelpers";
import { useToast } from "../components/Toast";
import Modal from "../components/Modal";
import DonationReceipt from "../components/DonationReceipt";
import { SkeletonCard, SkeletonStats } from "../components/Skeleton";
import styles from "./CampaignDetail.module.css";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

export default function CampaignDetail({ user }) {
  const { id } = useParams();
  const toast = useToast();
  const [campaign, setCampaign] = useState(null);
  const [chainData, setChainData] = useState(null); // combined chain summary + extra with raw values
  const [requests, setRequests] = useState([]);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [isManager, setIsManager] = useState(false);
  const [isDonor, setIsDonor] = useState(false);
  const [myContribution, setMyContribution] = useState({ eth: "0", sc: "0" });

  // Campaign Updates
  const [updates, setUpdates] = useState([]);
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateContent, setUpdateContent] = useState("");
  const [postingUpdate, setPostingUpdate] = useState(false);

  // Receipt modal
  const [receiptDonation, setReceiptDonation] = useState(null);

  // Phase milestones
  const [phases, setPhases] = useState([]);
  const [, setCurrentPhase] = useState(0);

  // Confirmation Modals
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundModal, setRefundModal] = useState(false);
  const [approveModal, setApproveModal] = useState(null); // requestIndex

  // AI Analysis
  const [aiAnalyses, setAiAnalyses] = useState({}); // { requestIndex: { score, report, loading } }

  // Refund progress tracking
  const [refundProgress, setRefundProgress] = useState({ total: 0, refunded: 0 });

  // Track which AI analyses have been queued (prevents infinite retry loop)
  const aiQueuedRef = useRef(new Set());

  // Donate modal
  const [donateModal, setDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donateCurrency, setDonateCurrency] = useState("ETH");
  const [ethUsdPrice, setEthUsdPrice] = useState(null);

  // Navigation tabs
  const [activeTab, setActiveTab] = useState("about");

  useEffect(() => { loadAll(); getEthUsdPrice().then(setEthUsdPrice); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load AI analysis for any donor viewing the campaign (so they can make informed donation decisions)
  useEffect(() => {
    if (user?.role !== "donor" || requests.length === 0) return;
    requests.forEach(req => {
      if (!req.complete && !aiQueuedRef.current.has(req.index) && !aiAnalyses[req.index]?.report && !aiAnalyses[req.index]?.loading) {
        aiQueuedRef.current.add(req.index);
        handleAiAnalyze(req);
      }
    });
  }, [requests, user?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dbCampaign, dbDonations, dbUpdates] = await Promise.all([
        apiFetch(`/campaigns/${id}`),
        apiFetch(`/donations/${id}`),
        apiFetch(`/campaign-updates/${id}`).catch(() => []),
      ]);
      setCampaign(dbCampaign);
      setDonations(dbDonations);
      setUpdates(dbUpdates);

      if (window.ethereum) {
        const contract = await getContract();
        const signer = contract.runner;
        const myAddress = await signer.getAddress();

        const summary = await contract.getSummary(parseInt(id));
        const extra = await contract.getCampaignExtra(parseInt(id));

        const cd = {
          // Formatted values for display
          minContribution: formatEth(summary[0]),
          raisedAmount: formatEth(summary[1]),
          numRequests: Number(summary[2]),
          approversCount: Number(summary[3]),
          manager: summary[4],
          name: summary[5],
          target: formatEth(summary[6]),
          totalDisbursed: formatEth(summary[7]),
          stablecoinRaised: formatTokenAmount(extra[0]),
          stablecoinDisbursed: formatTokenAmount(extra[1]),
          deadline: Number(extra[2]),
          cancelled: extra[3],
          description: extra[4],
          // Raw BigInt values for precise status calculation
          raisedAmountRaw: summary[1].toString(),
          targetRaw: summary[6].toString(),
          totalDisbursedRaw: summary[7].toString(),
        };
        setChainData(cd);

        setIsManager(myAddress.toLowerCase() === cd.manager.toLowerCase());
        setIsDonor(await contract.isApprover(parseInt(id), myAddress));

        // Get donor's contribution for refund display
        try {
          const contrib = await contract.getDonorContribution(parseInt(id), myAddress);
          setMyContribution({ eth: formatEth(contrib[0]), sc: formatTokenAmount(contrib[1]) });
        } catch { /* contract may not support this on older deployments */ }

        const reqs = [];
        for (let i = 0; i < cd.numRequests; i++) {
          const r = await contract.getRequestDetails(parseInt(id), i);
          const voted = await contract.hasVoted(parseInt(id), i, myAddress);
          reqs.push({
            index: i,
            description: r[0],
            value: r[6] ? formatTokenAmount(r[1]) : formatEth(r[1]),
            recipient: r[2],
            complete: r[3],
            approvalCount: Number(r[4]),
            category: r[5],
            isStablecoin: r[6],
            hasVoted: voted,
          });
        }
        setRequests(reqs);

        // Load phase milestones
        try {
          const phaseCount = Number(await contract.getPhaseCount(parseInt(id)));
          const curPhase = Number(await contract.getCurrentPhase(parseInt(id)));
          setCurrentPhase(curPhase);
          const loadedPhases = [];
          for (let i = 0; i < phaseCount; i++) {
            const p = await contract.getPhase(parseInt(id), i);
            loadedPhases.push({
              index: i,
              description: p[0],
              targetAmount: formatEth(p[1]),
              targetAmountRaw: p[1].toString(),
              vendor: p[2],
              requestCreated: p[3],
              requestId: Number(p[4]),
            });
          }
          setPhases(loadedPhases);
        } catch { /* older contract without phases */ }

        // Load refund progress for cancelled campaigns
        if (cd.cancelled) {
          try {
            const donorCount = Number(await contract.getDonorCount(parseInt(id)));
            let refundedCount = 0;
            for (let i = 0; i < donorCount; i++) {
              const donorAddr = await contract.campaignDonors(parseInt(id), i);
              const refunded = await contract.isRefunded(parseInt(id), donorAddr);
              if (refunded) refundedCount++;
            }
            setRefundProgress({ total: donorCount, refunded: refundedCount });
          } catch { /* refund tracking not available */ }
        }
      }
    } catch (err) {
      console.error("Failed to load campaign:", err);
      toast.error("Failed to load campaign data");
    } finally {
      setLoading(false);
    }
  };

  // ── Actions ──

  const approveRequest = async (reqIndex) => {
    setApproveModal(null);
    if (user?.role !== "donor") return toast.error("Only donors can vote on requests");
    setActionLoading(`approve-${reqIndex}`);
    try {
      const contract = await getContract();
      const tx = await contract.approveRequest(parseInt(id), reqIndex);
      await tx.wait();
      toast.success("Vote recorded! Funds auto-release at >50% approval.");
      loadAll();
    } catch (err) {
      toast.error("Vote failed: " + (err.reason || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const finalizeRequest = async (reqIndex) => {
    if (!isManager) return toast.error("Only the campaign manager can release funds");
    setActionLoading(`finalize-${reqIndex}`);
    try {
      const contract = await getContract();
      const tx = await contract.finalizeRequest(parseInt(id), reqIndex);
      await tx.wait();
      toast.success("Funds released to recipient!");
      loadAll();
    } catch (err) {
      toast.error("Release failed: " + (err.reason || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const cancelCampaign = async () => {
    setCancelModal(false);
    if (!isManager) return toast.error("Only the campaign manager can cancel");
    setActionLoading("cancel");
    try {
      const contract = await getContract();
      const tx = await contract.cancelCampaign(parseInt(id));
      await tx.wait();

      // Auto-post cancellation reason as a campaign update
      const reason = cancelReason.trim() || "No reason provided.";
      try {
        const newUpdate = await apiPost("/campaign-updates", {
          campaignId: parseInt(id),
          title: "Campaign Cancelled",
          content: `This campaign has been cancelled by the manager.\n\nReason: ${reason}\n\nAll donors have been automatically refunded their proportional share of remaining funds.`,
        });
        setUpdates(prev => [newUpdate, ...prev]);
      } catch { /* update post failed, not critical */ }

      // Broadcast notification to all donors of this campaign
      try {
        await apiPost("/notifications/cancel-broadcast", {
          campaignId: parseInt(id),
          reason,
          txHash: tx.hash,
        });
      } catch (e) { console.warn('Notification broadcast failed:', e.message); }

      setCancelReason("");
      toast.success("Campaign cancelled. All donors have been automatically refunded.");
      loadAll();
    } catch (err) {
      toast.error("Cancel failed: " + (err.reason || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const claimRefund = async () => {
    setRefundModal(false);
    if (user?.role !== "donor") return toast.error("Only donors can claim refunds");
    setActionLoading("refund");
    try {
      const contract = await getContract();
      const tx = await contract.claimRefund(parseInt(id));
      await tx.wait();
      toast.success("Refund claimed! Funds returned to your wallet.");
      loadAll();
    } catch (err) {
      toast.error("Refund failed: " + (err.reason || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const postUpdate = async (e) => {
    e.preventDefault();
    if (!updateTitle.trim() || !updateContent.trim()) return toast.warning("Title and content are required");
    setPostingUpdate(true);
    try {
      const newUpdate = await apiPost("/campaign-updates", {
        campaignId: parseInt(id),
        title: updateTitle.trim(),
        content: updateContent.trim(),
      });
      setUpdates(prev => [newUpdate, ...prev]);
      setUpdateTitle("");
      setUpdateContent("");
      toast.success("Update posted!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPostingUpdate(false);
    }
  };

  // ── Donate Handler ──
  const handleDonate = async () => {
    if (!user) return toast.error("Please log in to donate");
    if (user.role !== "donor") return toast.error("Only donors can contribute");
    if (!donateAmount || parseFloat(donateAmount) <= 0) return toast.warning("Enter a valid donation amount");

    setActionLoading("donate");
    try {
      const contract = await getContract();
      let receipt;

      if (donateCurrency === "ETH") {
        const tx = await contract.donate(id, { value: ethers.parseEther(donateAmount) });
        receipt = await tx.wait();
      } else {
        // ERC-20 stablecoin flow
        const stablecoinAddr = await contract.stablecoinAddress();
        if (stablecoinAddr === ethers.ZeroAddress) {
          toast.error("Stablecoin not configured on this contract");
          setActionLoading(null);
          return;
        }
        const signer = await getSigner();
        const tokenContract = new ethers.Contract(stablecoinAddr, ERC20_ABI, signer);

        let decimals = 6;
        try { decimals = Number(await tokenContract.decimals()); } catch { /* default 6 */ }
        const parsedAmount = ethers.parseUnits(donateAmount, decimals);

        toast.info("Approving token spend...");
        const contractAddress = getContractAddr();
        const approveTx = await tokenContract.approve(contractAddress, parsedAmount);
        await approveTx.wait();
        toast.info("Approval confirmed. Sending donation...");

        const tx = await contract.donateStablecoin(id, parsedAmount);
        receipt = await tx.wait();
      }

      await apiPost("/donations", {
        campaignId: id,
        donorWallet: user.walletAddress.toLowerCase(),
        amount: donateAmount,
        currency: donateCurrency,
        txHash: receipt.hash,
        donorName: user.fullName,
      });

      toast.success(`Donated ${donateAmount} ${donateCurrency} successfully!`);
      setDonateModal(false);
      setDonateAmount("");
      loadAll();
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed: " + (err.reason || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAiAnalyze = async (req) => {
    setAiAnalyses(prev => ({ ...prev, [req.index]: { loading: true } }));
    try {
      const result = await aiAnalyzeRequest(
        req.index, parseInt(id), req.description, req.value, req.category
      );
      setAiAnalyses(prev => ({
        ...prev,
        [req.index]: { score: result.score, report: result.report, loading: false }
      }));
    } catch (err) {
      setAiAnalyses(prev => ({
        ...prev,
        [req.index]: { error: err.message, loading: false }
      }));
      toast.error("AI analysis failed: " + err.message);
    }
  };

  // Continue refunds for cancelled campaigns with >20 donors
  const continueRefunds = async () => {
    setActionLoading("continue-refunds");
    try {
      const contract = await getContract();
      const donorCount = Number(await contract.getDonorCount(parseInt(id)));
      // Find start index: first unrefunded donor
      let startIdx = 0;
      for (let i = 0; i < donorCount; i++) {
        const donors = await contract.campaignDonors(parseInt(id), i);
        const isRefunded = await contract.isRefunded(parseInt(id), donors);
        if (!isRefunded) { startIdx = i; break; }
      }
      const batchSize = 20;
      const tx = await contract.continueRefunds(parseInt(id), startIdx, batchSize);
      await tx.wait();
      toast.success("Refund batch processed!");
      loadAll();
    } catch (err) {
      toast.error("Continue refunds failed: " + (err.reason || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Loading State ──

  if (loading) {
    return (
      <div className="container">
        <SkeletonStats />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // ── Derived Values ──

  const status = getCampaignStatus(chainData);
  const hasRefundable = parseFloat(myContribution.eth) > 0 || parseFloat(myContribution.sc) > 0;

  // Campaign image
  const imageUrl = campaign?.imageUrl
    ? (campaign.imageUrl.startsWith("http") ? campaign.imageUrl : `${API_URL}${campaign.imageUrl}`)
    : null;

  // Progress percentage — combine ETH + stablecoin (converted to ETH equiv.)
  const raisedEth = parseFloat(chainData?.raisedAmount) || 0;
  const stableRaised = parseFloat(chainData?.stablecoinRaised || 0);
  const stableInEth = ethUsdPrice ? stablecoinToEth(stableRaised, ethUsdPrice) : 0;
  const totalRaisedEquiv = raisedEth + stableInEth;
  const progressPct = Math.min(100, (totalRaisedEquiv / (parseFloat(chainData?.target) || 1)) * 100);
  const daysLeft = chainData?.deadline && !chainData?.cancelled && status?.key !== "expired"
    ? Math.max(0, Math.ceil((chainData.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className={styles.pageContainer}>

      {/* Cancel Campaign Modal */}
      {cancelModal && (
        <div className={styles.modalOverlay} onClick={() => setCancelModal(false)}>
          <div className={styles.modalPanel} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Cancel Campaign?</h3>
            <p className={styles.modalDesc}>
              This will permanently cancel the campaign and automatically refund all donors. This action cannot be undone.
            </p>
            <label className={styles.modalLabel}>
              REASON FOR CANCELLATION
            </label>
            <textarea
              className={styles.modalTextarea}
              placeholder="e.g. Unable to secure required permits..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setCancelModal(false)}>
                Keep Campaign
              </button>
              <button className={styles.modalConfirmBtn} onClick={cancelCampaign}>
                Cancel Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      <Modal isOpen={refundModal} title="Claim Refund?"
        message={`You will receive a proportional refund of your contribution (${myContribution.eth} ETH${parseFloat(myContribution.sc) > 0 ? ` + ${myContribution.sc} stablecoin` : ""}) back to your wallet.`}
        confirmText="Claim Refund" onConfirm={claimRefund} onCancel={() => setRefundModal(false)} />

      {/* Approve Modal */}
      <Modal isOpen={approveModal !== null} title="Approve Spending Request?"
        message="Your vote is recorded on-chain and cannot be changed. If this tips approval over 50%, funds will be auto-released to the recipient."
        confirmText="Approve" onConfirm={() => approveRequest(approveModal)} onCancel={() => setApproveModal(null)} />

      {/* Donate Modal */}
      {donateModal && (
        <div className={styles.modalOverlay} onClick={() => setDonateModal(false)}>
          <div className={styles.donateModalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.donateModalTitle}>
              <span className="material-symbols-outlined">volunteer_activism</span>
              Back This Project
            </h3>
            <p className={styles.donateModalCampaign}>{campaign?.title}</p>

            <div className={styles.donateFormGroup}>
              <label className={styles.donateLabel}>Currency</label>
              <div className={styles.currencyToggle}>
                {["ETH", "mUSDT"].map(cur => (
                  <button key={cur}
                    className={`${styles.currencyBtn} ${donateCurrency === cur ? styles.currencyActive : ""}`}
                    onClick={() => setDonateCurrency(cur)}>
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.donateFormGroup}>
              <label className={styles.donateLabel}>Amount</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder={donateCurrency === "ETH" ? "0.1" : "100"}
                value={donateAmount}
                onChange={(e) => setDonateAmount(e.target.value)}
                className={styles.donateInput}
                autoFocus
              />
            </div>

            {chainData?.minContribution && donateCurrency === "ETH" && (
              <p className={styles.donateHint}>Minimum: {chainData.minContribution} ETH</p>
            )}

            <div className={styles.donateActions}>
              <button className={styles.donateCancelBtn} onClick={() => setDonateModal(false)}>Cancel</button>
              <button
                className={styles.donateConfirmBtn}
                onClick={handleDonate}
                disabled={actionLoading === "donate"}
              >
                {actionLoading === "donate" ? "Processing..." : `Donate ${donateAmount || "0"} ${donateCurrency}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptDonation && (
        <DonationReceipt donation={receiptDonation} campaignTitle={campaign?.title} onClose={() => setReceiptDonation(null)} />
      )}

      {/* Back Header */}
      <header className={styles.backHeader}>
        <Link to="/campaigns" className={styles.backLink}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Campaigns
        </Link>
        <div className={styles.headerActions}>
          <button className={styles.headerIconBtn} aria-label="Share">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button className={styles.headerIconBtn} aria-label="Favorite">
            <span className="material-symbols-outlined">favorite_border</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        {imageUrl ? (
          <img src={imageUrl} alt={campaign?.title} className={styles.heroImage} />
        ) : (
          <div className={styles.heroImage} style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" }} />
        )}
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.aiBadges}>
            {status && (
              <span className={styles.aiBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem", color: "var(--sn-primary, #FFB59A)" }}>
                  {status.key === "active" ? "verified" : status.key === "funded" ? "check_circle" : "info"}
                </span>
                {status.label}
              </span>
            )}
            {campaign?.category && (
              <span className={styles.aiBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem", color: "var(--sn-secondary, #FFB955)" }}>category</span>
                {campaign.category}
              </span>
            )}
            {chainData?.cancelled && (
              <span className={styles.aiBadge} style={{ borderColor: "rgba(255, 180, 171, 0.3)", color: "var(--sn-error, #FFB4AB)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem" }}>cancel</span>
                CANCELLED
              </span>
            )}
            {chainData && !chainData.cancelled && (
              <span className={styles.aiBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: "0.875rem", color: "var(--sn-primary, #FFB59A)" }}>shield</span>
                Web3 Verified
              </span>
            )}
          </div>
          <h1 className={styles.heroTitle}>{campaign?.title || `Campaign #${id}`}</h1>
        </div>
      </section>

      {/* Creator Bar */}
      <div className={styles.creatorBar}>
        <div className={styles.creatorInfo}>
          <div className={styles.creatorAvatar}>
            {(() => {
              const name = campaign?.createdBy?.fullName;
              if (name) {
                const parts = name.trim().split(/\s+/);
                return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
              }
              return chainData?.manager ? chainData.manager.substring(2, 4).toUpperCase() : "??";
            })()}
          </div>
          <div>
            <div className={styles.creatorName}>
              {campaign?.createdBy?.fullName || (chainData?.manager ? shortenAddress(chainData.manager) : "Unknown")}
              <span className="material-symbols-outlined" style={{ fontSize: "1rem", color: "var(--sn-primary, #FFB59A)" }}>check_circle</span>
            </div>
            <div className={styles.creatorSubtitle}>
              {campaign?.createdBy?.fullName ? shortenAddress(chainData?.manager || "") : "Campaign Creator"}
            </div>
          </div>
        </div>
        <button className={styles.followBtn}>FOLLOW</button>
      </div>

      {/* Navigation Tabs */}
      <nav className={styles.navTabs}>
        <button
          className={`${styles.navTab} ${activeTab === "about" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("about")}
        >
          About
        </button>
        <button
          className={`${styles.navTab} ${activeTab === "updates" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("updates")}
        >
          Updates ({updates.length})
        </button>
        <button
          className={`${styles.navTab} ${activeTab === "donors" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("donors")}
        >
          Donors ({chainData?.approversCount || 0})
        </button>
        <button
          className={`${styles.navTab} ${activeTab === "ledger" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("ledger")}
        >
          Ledger
        </button>
      </nav>

      {/* Content Area */}
      <div className={styles.contentWrapper}>
        <div className={styles.mainGrid}>

          {/* Left Column */}
          <div className={styles.leftCol}>

            {/* About Tab */}
            {activeTab === "about" && (
              <>
                {/* The Vision */}
                <div className={styles.contentPanel}>
                  <h3 className={styles.sectionTitle}>The Vision</h3>
                  <p className={styles.bodyText}>{campaign?.description}</p>
                  {parseFloat(chainData?.stablecoinRaised || 0) > 0 && (
                    <div className={styles.stablecoinVault}>
                      <p className={styles.stablecoinLabel}>STABLECOIN VAULT</p>
                      <p className={styles.bodyTextVariant} style={{ marginTop: 0 }}>
                        {chainData.stablecoinRaised} raised &middot; {chainData.stablecoinDisbursed} disbursed
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Trust Analysis (campaign-level, set at creation) */}
                {(campaign?.aiTrustScore !== null && campaign?.aiTrustScore !== undefined) || campaign?.aiAnalysis ? (
                  <div className={styles.contentPanel} style={{ borderColor: 'rgba(255, 181, 154, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--sn-primary, #FFB59A)', fontSize: '1.5rem' }}>auto_awesome</span>
                      <h3 className={styles.sectionTitle} style={{ margin: 0 }}>AI Trust Assessment</h3>
                      {campaign.aiTrustScore !== null && campaign.aiTrustScore !== undefined && (
                        <span style={{
                          marginLeft: 'auto',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          background: campaign.aiTrustScore >= 70 ? 'rgba(168, 213, 162, 0.15)' : campaign.aiTrustScore >= 40 ? 'rgba(255, 185, 85, 0.15)' : 'rgba(255, 100, 100, 0.15)',
                          color: campaign.aiTrustScore >= 70 ? '#A8D5A2' : campaign.aiTrustScore >= 40 ? '#FFB955' : '#FF6464',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.875rem',
                          fontWeight: 700
                        }}>
                          {campaign.aiTrustScore}/100
                        </span>
                      )}
                    </div>
                    {campaign.aiAnalysis && (
                      <p className={styles.bodyText} style={{ whiteSpace: 'pre-wrap' }}>{campaign.aiAnalysis}</p>
                    )}
                    <p style={{
                      fontSize: '0.6875rem',
                      color: 'var(--sn-on-surface-variant, #E4BEB1)',
                      opacity: 0.6,
                      marginTop: '0.75rem',
                      letterSpacing: '0.05em'
                    }}>
                      Generated by Gemini 2.5 at campaign creation. Independent automated assessment.
                    </p>
                  </div>
                ) : null}

                {/* Milestones */}
                {phases.length > 0 && (
                  <section>
                    <h3 className={styles.sectionTitle}>Milestones</h3>
                    <div className={styles.timelineGrid}>
                      {phases.map((phase, i) => {
                        const linkedReq = phase.requestCreated ? requests.find(r => r.index === phase.requestId) : null;
                        const isCompleted = linkedReq?.complete;
                        const isActive = linkedReq && !linkedReq.complete;

                        return (
                          <div key={i} className={`${styles.timelineItem} ${isActive ? styles.active : ""} ${isCompleted ? styles.completed : ""}`}>
                            <span className={styles.timelineNum}>
                              {i < 9 ? `0${i + 1}` : i + 1}
                            </span>
                            <div style={{ flex: 1 }}>
                              <h4 className={styles.timelineTitle}>{phase.description}</h4>
                              <p className={styles.timelineDesc}>
                                Target: {phase.targetAmount} ETH &middot; Vendor: {shortenAddress(phase.vendor)}
                              </p>
                              {isActive && (
                                <div className={styles.phaseProgress}>
                                  <span className={styles.phaseProgressLabel}>
                                    Approvals: {linkedReq.approvalCount} / {chainData?.approversCount}
                                  </span>
                                  <div className={styles.phaseProgressTrack}>
                                    <div
                                      className={styles.phaseProgressFill}
                                      style={{ width: `${chainData?.approversCount ? (linkedReq.approvalCount / chainData.approversCount) * 100 : 0}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* DAO Governance */}
                <section>
                  <div className={styles.sectionTitle}>
                    <span>Governance</span>
                    <span className={styles.sectionLabel}>LIVE PROPOSALS</span>
                  </div>

                  {requests.length === 0 ? (
                    <p className={styles.bodyTextVariant}>No spending requests have been submitted yet.</p>
                  ) : (
                    <div className={styles.govGrid}>
                      {requests.map((r) => {
                        const canFinalize = r.approvalCount > (chainData?.approversCount || 0) / 2;
                        const isCancelled = chainData?.cancelled;

                        return (
                          <div key={r.index} className={styles.govCard} style={{ opacity: r.complete ? 0.6 : 1 }}>
                            <div className={styles.govCardInner}>
                              <div className={`${styles.govIconWrapper} ${r.complete ? styles.govIconComplete : styles.govIconActive}`}>
                                <span className="material-symbols-outlined">
                                  {r.complete ? "check" : "receipt_long"}
                                </span>
                              </div>
                              <div>
                                <h4 className={styles.govTitle}>{r.description}</h4>
                                <p className={styles.govAmount}>
                                  Req: {r.value} {r.isStablecoin ? "STABLE" : "ETH"} &middot; {r.approvalCount}/{chainData?.approversCount} Approvals
                                </p>
                                {aiAnalyses[r.index]?.loading && (
                                  <p className={styles.govAiHint} style={{ opacity: 0.7 }}>
                                    AI: analysing...
                                  </p>
                                )}
                                {aiAnalyses[r.index]?.report && (
                                  <p className={styles.govAiHint} title={aiAnalyses[r.index].report}>
                                    AI {typeof aiAnalyses[r.index].score === 'number' ? `(${aiAnalyses[r.index].score}/100)` : ''}: {aiAnalyses[r.index].report.substring(0, 120)}{aiAnalyses[r.index].report.length > 120 ? '...' : ''}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className={styles.govActions}>
                              {!r.complete && !isCancelled && (
                                <>
                                  {isDonor && user?.role === "donor" && !r.hasVoted && (
                                    <button className={styles.actionBtn} onClick={() => setApproveModal(r.index)} disabled={actionLoading === `approve-${r.index}`}>
                                      {actionLoading === `approve-${r.index}` ? "..." : "VOTE"}
                                    </button>
                                  )}
                                  {isDonor && r.hasVoted && (
                                    <span className={`${styles.govStatusLabel} ${styles.govStatusVoted}`}>VOTED</span>
                                  )}
                                  {isManager && canFinalize && (
                                    <button className={`${styles.actionBtn} ${styles.releaseBtn}`} onClick={() => finalizeRequest(r.index)} disabled={actionLoading === `finalize-${r.index}`}>
                                      RELEASE
                                    </button>
                                  )}
                                </>
                              )}
                              {r.complete && (
                                <span className={`${styles.govStatusLabel} ${styles.govStatusReleased}`}>RELEASED</span>
                              )}
                              {isCancelled && !r.complete && (
                                <span className={`${styles.govStatusLabel} ${styles.govStatusCancelled}`}>CANCELLED</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Updates Tab */}
            {activeTab === "updates" && (
              <section>
                <div className={styles.sectionTitle}>
                  <span>Campaign Updates</span>
                  <span className={styles.sectionLabel}>COMMUNICATION</span>
                </div>

                {isManager && user?.role === "charity" && (
                  <form onSubmit={postUpdate} className={styles.updateForm}>
                    <input
                      className={styles.updateFormInput}
                      placeholder="Update Title"
                      value={updateTitle}
                      onChange={e => setUpdateTitle(e.target.value)}
                      required
                    />
                    <textarea
                      className={styles.updateFormTextarea}
                      placeholder="Detail progress..."
                      value={updateContent}
                      onChange={e => setUpdateContent(e.target.value)}
                      required
                    />
                    <button type="submit" className={styles.actionBtn} disabled={postingUpdate}>
                      POST UPDATE
                    </button>
                  </form>
                )}

                {updates.length === 0 ? (
                  <p className={styles.bodyTextVariant}>No updates posted yet.</p>
                ) : (
                  <div className={styles.updatesTimeline}>
                    {updates.map((u, i) => (
                      <div key={i} className={styles.updateItem}>
                        <div className={styles.updateHeader}>
                          <h4 className={styles.updateItemTitle}>{u.title}</h4>
                          <span className={styles.updateDate}>{new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className={styles.bodyTextVariant} style={{ marginTop: 0 }}>{u.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Donors Tab */}
            {activeTab === "donors" && (
              <section>
                <div className={styles.sectionTitle}>
                  <span>All Donors</span>
                  <span className={styles.sectionLabel}>{donations.length} CONTRIBUTIONS</span>
                </div>
                {donations.length === 0 ? (
                  <p className={styles.bodyTextVariant}>No contributions yet.</p>
                ) : (
                  <div className={styles.govGrid}>
                    {donations.map((d, i) => (
                      <div key={i} className={styles.govCard}>
                        <div className={styles.govCardInner}>
                          <div className={styles.govIconWrapper} style={{ color: "var(--sn-primary, #FFB59A)" }}>
                            <span className="material-symbols-outlined">person</span>
                          </div>
                          <div>
                            <h4 className={styles.govTitle}>{shortenAddress(d.donorWallet)}</h4>
                            <p className={styles.govAmount}>
                              {d.amount} {d.currency || "ETH"} &middot; {new Date(d.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          className={styles.donorReceiptBtn}
                          onClick={() => setReceiptDonation(d)}
                          aria-label="View receipt"
                        >
                          <span className="material-symbols-outlined">receipt</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Ledger Tab */}
            {activeTab === "ledger" && (
              <section>
                <div className={styles.sectionTitle}>
                  <span>On-Chain Ledger</span>
                  <span className={styles.sectionLabel}>BLOCKCHAIN DATA</span>
                </div>
                <div className={styles.contentPanel}>
                  <div className={styles.metricsGrid}>
                    <div className={styles.metricBox}>
                      <p className={styles.metricLabel}>TOTAL RAISED</p>
                      <p className={styles.metricValue}>{totalRaisedEquiv.toFixed(4)} ETH</p>
                    </div>
                    <div className={styles.metricBox}>
                      <p className={styles.metricLabel}>ETH TARGET</p>
                      <p className={styles.metricValue}>{chainData?.target || "0"}</p>
                    </div>
                    <div className={styles.metricBox}>
                      <p className={styles.metricLabel}>DISBURSED</p>
                      <p className={styles.metricValue}>{chainData?.totalDisbursed || "0"}</p>
                    </div>
                    <div className={styles.metricBox}>
                      <p className={styles.metricLabel}>REQUESTS</p>
                      <p className={styles.metricValue}>{chainData?.numRequests || 0}</p>
                    </div>
                    {parseFloat(chainData?.stablecoinRaised || 0) > 0 && (
                      <>
                        <div className={styles.metricBox}>
                          <p className={styles.metricLabel}>STABLE RAISED</p>
                          <p className={styles.metricValue}>{chainData.stablecoinRaised}</p>
                        </div>
                        <div className={styles.metricBox}>
                          <p className={styles.metricLabel}>STABLE DISBURSED</p>
                          <p className={styles.metricValue}>{chainData.stablecoinDisbursed}</p>
                        </div>
                      </>
                    )}
                  </div>
                  {chainData?.manager && (
                    <div style={{ marginTop: "1.5rem" }}>
                      <p className={styles.metricLabel}>CONTRACT MANAGER</p>
                      <p className={styles.bodyTextVariant} style={{ marginTop: "0.25rem", fontFamily: "monospace", fontSize: "0.8125rem" }}>
                        {chainData.manager}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right Sidebar - Funding Portal */}
          <aside className={styles.rightCol}>
            <div className={styles.fundingPortal}>

              {/* Amount Raised */}
              <div className={styles.raisedHeader}>
                <div className={styles.raisedRow}>
                  <span className={styles.raisedAmount}>{totalRaisedEquiv.toFixed(4)}</span>
                  <span className={styles.raisedCurrency}>ETH</span>
                </div>
                <div className={styles.goalText}>Raised of {chainData?.target || "0.00"} ETH Goal</div>
                {stableRaised > 0 && (
                  <div className={styles.stableBreakdown}>
                    {raisedEth.toFixed(4)} ETH + {stableRaised.toFixed(2)} mUSDT ({stableInEth.toFixed(4)} ETH)
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className={styles.progressLabels}>
                  <span className={styles.progressLabel}>{Math.round(progressPct)}% Funded</span>
                  <span className={styles.progressLabel}>{daysLeft !== null ? `${daysLeft} Days Left` : "-"}</span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className={styles.metricsGrid}>
                <div className={styles.metricBox}>
                  <p className={styles.metricLabel}>BACKERS</p>
                  <p className={styles.metricValue}>{chainData?.approversCount || "0"}</p>
                </div>
                <div className={styles.metricBox}>
                  <p className={styles.metricLabel}>PLATFORM FEE</p>
                  <p className={styles.metricValue}>0%</p>
                </div>
              </div>

              {/* Back This Project / Donate */}
              {user?.role === "donor" && !chainData?.cancelled && status?.key !== "expired" && status?.key !== "funded" && status?.key !== "completed" ? (
                <button className={styles.primaryActionBtn} onClick={() => setDonateModal(true)}>
                  Back This Project
                </button>
              ) : (
                <button className={styles.primaryActionBtn} disabled>
                  {chainData?.cancelled ? "Cancelled"
                    : status?.key === "expired" ? "Deadline Passed"
                    : status?.key === "funded" ? "Goal Reached"
                    : status?.key === "completed" ? "Campaign Completed"
                    : "Donation Unavailable"}
                </button>
              )}

              {/* Smart Contract Disclaimer */}
              <div className={styles.contractDisclaimer}>
                <span className="material-symbols-outlined">verified_user</span>
                Smart Contract Audited &amp; Secured
              </div>

              {/* Manager Controls / Refund Controls */}
              {(isManager || (isDonor && chainData?.cancelled)) && (
                <div className={styles.managerControlsWrapper}>
                  {isManager && !chainData?.cancelled && status?.key !== "cancelled" && (
                    <button className={styles.managerControlBtn} onClick={() => setCancelModal(true)} disabled={actionLoading === "cancel"}>
                      {actionLoading === "cancel" ? "STOPPING..." : "CANCEL CAMPAIGN"}
                    </button>
                  )}
                  {chainData?.cancelled && isDonor && hasRefundable && (
                    <button className={`${styles.managerControlBtn} ${styles.safe}`} onClick={() => setRefundModal(true)} disabled={actionLoading === "refund"}>
                      CLAIM REFUND
                    </button>
                  )}
                  {chainData?.cancelled && isManager && refundProgress.total > 0 && refundProgress.refunded < refundProgress.total && (
                    <button className={`${styles.managerControlBtn} ${styles.safe}`} onClick={continueRefunds} disabled={actionLoading === "continue-refunds"}>
                      PROCESS BATCH REFUNDS
                    </button>
                  )}
                </div>
              )}

              {/* Recent Contributions */}
              <div className={styles.donorsSection}>
                <p className={styles.sectionLabel}>RECENT CONTRIBUTIONS</p>
                {donations.length === 0 ? (
                  <p className={styles.emptyText}>No contributions yet.</p>
                ) : (
                  <div className={styles.donorsList}>
                    {donations.slice(0, 5).map((d, i) => (
                      <div key={i} className={styles.donorRow}>
                        <span className={styles.donorAddress}>{shortenAddress(d.donorWallet)}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className={styles.donorAmount}>{d.amount} {d.currency || "ETH"}</span>
                          <button
                            className={styles.donorReceiptBtn}
                            onClick={() => setReceiptDonation(d)}
                            aria-label="View receipt"
                          >
                            <span className="material-symbols-outlined">receipt</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
