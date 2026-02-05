import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { getContract, apiFetch, apiPost, formatEth, shortenAddress, API_URL, getAuthToken, aiGenerateCampaign } from "../utils/ethereum";
import { getCampaignStatus } from "../utils/campaignHelpers";
import { useToast } from "../components/Toast";
import ProgressBar from "../components/ProgressBar";
import { SkeletonCard } from "../components/Skeleton";
import styles from "./Dashboard.module.css";

const SPEND_CATEGORIES = ["Medical", "Education", "Transport", "Admin", "Infrastructure", "Staffing", "Equipment", "Other"];

export default function Dashboard({ user }) {
  const toast = useToast();

  // Campaign creation
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("General");
  const [deadlineDays, setDeadlineDays] = useState("0");
  const [minContribution, setMinContribution] = useState("0.01");
  const [imageFile, setImageFile] = useState(null);
  const [creating, setCreating] = useState(false);

  // Phased milestones
  const [phases, setPhases] = useState([]);
  const [showPhases, setShowPhases] = useState(false);

  // AI generation
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Spending requests
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqValue, setReqValue] = useState("");
  const [reqRecipient, setReqRecipient] = useState(user?.walletAddress || "");
  const [reqCategory, setReqCategory] = useState("Other");
  const [creatingReq, setCreatingReq] = useState(false);

  // Data
  const [chainData, setChainData] = useState({});
  const [myDonations, setMyDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [charityTab, setCharityTab] = useState("create");
  const [donorTab, setDonorTab] = useState("overview");

  useEffect(() => {
    const load = async () => {
      if (user?.role === "charity") await loadMyCampaigns();
      if (user?.role === "donor") await loadMyDonations();
      setLoading(false);
    };
    if (user) load();
    else setLoading(false);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMyCampaigns = async () => {
    try {
      const res = await apiFetch("/campaigns");
      const all = res.campaigns || res;
      const mine = all.filter(c => c.creatorWallet?.toLowerCase() === user.walletAddress?.toLowerCase());
      setMyCampaigns(mine);
      if (window.ethereum && mine.length > 0) {
        const contract = await getContract();
        const data = {};
        for (const c of mine) {
          try {
            const s = await contract.getSummary(c.smartContractId);
            const extra = await contract.getCampaignExtra(c.smartContractId);
            data[c.smartContractId] = {
              raised: formatEth(s[1]), raisedAmountRaw: s[1].toString(),
              requests: Number(s[2]), donors: Number(s[3]),
              target: formatEth(s[6]), targetRaw: s[6].toString(),
              disbursed: formatEth(s[7]), totalDisbursedRaw: s[7].toString(),
              deadline: Number(extra[2]), cancelled: extra[3],
            };
          } catch (e) { console.warn('Chain data unavailable', c.smartContractId); }
        }
        setChainData(data);
      }
    } catch (err) { console.error(err); }
  };

  const loadMyDonations = async () => {
    try {
      const d = await apiFetch(`/donations/by-wallet/${user.walletAddress.toLowerCase()}`);
      setMyDonations(d);
    } catch (e) { console.warn('Could not load donations'); }
  };

  // Phase helpers
  const addPhase = () => {
    setPhases([...phases, { description: "", target: "", vendor: user?.walletAddress || "" }]);
  };
  const updatePhase = (index, field, value) => {
    const updated = [...phases];
    updated[index][field] = value;
    setPhases(updated);
  };
  const removePhase = (index) => {
    setPhases(phases.filter((_, i) => i !== index));
  };

  // AI-powered campaign generation
  const handleAiGenerate = async () => {
    if (!title) return toast.warning("Enter a campaign title first so AI can generate content");
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await aiGenerateCampaign(title, category, goal || "10");
      setAiResult(result);
      // Auto-fill description
      if (result.description) setDesc(result.description);
      // Auto-fill phases if AI suggested them and user hasn't set any
      if (result.phases && result.phases.length > 0 && phases.length === 0) {
        setShowPhases(true);
        setPhases(result.phases.map(p => ({
          description: p.description,
          target: p.targetAmount || p.target || "",
          vendor: user?.walletAddress || "",
        })));
      }
      toast.success("AI content generated! Review and edit before publishing.");
    } catch (err) {
      toast.error("AI generation failed: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Role-checked campaign creation with event parsing + image upload
  const createCampaign = async () => {
    if (user?.role !== "charity") return toast.error("Only charity accounts can create campaigns");
    if (!title || !goal) return toast.warning("Please fill in title and goal");

    // Validate phases if enabled
    if (showPhases && phases.length > 0) {
      for (let i = 0; i < phases.length; i++) {
        if (!phases[i].description || !phases[i].target || !phases[i].vendor) {
          return toast.warning(`Phase ${i + 1}: All fields are required`);
        }
        if (i > 0 && parseFloat(phases[i].target) <= parseFloat(phases[i - 1].target)) {
          return toast.warning(`Phase ${i + 1}: Target must be greater than Phase ${i}`);
        }
      }
      const lastTarget = parseFloat(phases[phases.length - 1].target);
      if (Math.abs(lastTarget - parseFloat(goal)) > 0.0001) {
        return toast.warning("The final phase target must equal the campaign goal");
      }
    }

    setCreating(true);
    try {
      const contract = await getContract();

      // Build phase arrays (empty if no phases)
      const phaseDescs = showPhases ? phases.map(p => p.description) : [];
      const phaseTargets = showPhases ? phases.map(p => ethers.parseEther(p.target)) : [];
      const phaseVendors = showPhases ? phases.map(p => p.vendor) : [];

      const tx = await contract.createCampaign(
        title, desc,
        ethers.parseEther(goal),
        ethers.parseEther(minContribution || "0.01"),
        parseInt(deadlineDays) || 0,
        phaseDescs,
        phaseTargets,
        phaseVendors
      );
      const receipt = await tx.wait();

      // Parse CampaignCreated event for the actual ID (race-condition safe)
      const iface = contract.interface;
      const campaignCreatedLog = receipt.logs
        .map(log => { try { return iface.parseLog(log); } catch { return null; } })
        .find(parsed => parsed?.name === 'CampaignCreated');
      const newId = campaignCreatedLog ? Number(campaignCreatedLog.args.campaignId) : Number(await contract.campaignCount()) - 1;

      // Upload image if provided
      let imageUrl = `https://placehold.co/600x300/1e293b/10b981?text=${encodeURIComponent(title)}&font=raleway`;
      if (imageFile) {
        try {
          const formData = new FormData();
          formData.append('image', imageFile);
          const uploadRes = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.url) imageUrl = uploadData.url;
        } catch (e) { console.warn('Image upload failed, using placeholder'); }
      }

      await apiPost("/campaigns", {
        smartContractId: newId, title, description: desc, goal, category,
        deadlineDays: parseInt(deadlineDays) || 0,
        imageUrl,
        creatorWallet: user.walletAddress.toLowerCase(), createdBy: user._id,
        aiTrustScore: aiResult?.trustScore || null,
        aiAnalysis: aiResult?.analysis || null,
        aiGeneratedDescription: aiResult?.description || null,
        phases: showPhases ? phases.map((p, i) => ({
          description: p.description,
          targetAmount: p.target,
          vendor: p.vendor,
          phaseIndex: i,
        })) : [],
      });
      toast.success("Campaign launched on blockchain!");
      setTitle(""); setGoal(""); setDesc(""); setCategory("General"); setDeadlineDays("0"); setMinContribution("0.01"); setImageFile(null);
      setPhases([]); setShowPhases(false); setAiResult(null);
      loadMyCampaigns();
    } catch (err) {
      console.error(err);
      toast.error("Failed: " + (err.reason || err.message));
    } finally { setCreating(false); }
  };

  // Role-checked spending request creation with event parsing
  const createSpendingRequest = async () => {
    if (user?.role !== "charity") return toast.error("Only charity accounts can create spending requests");
    if (!selectedCampaign || !reqDesc || !reqValue || !reqRecipient) return toast.warning("Please fill all fields");
    setCreatingReq(true);
    try {
      const contract = await getContract();
      const tx = await contract.createRequest(
        parseInt(selectedCampaign),
        reqDesc,
        ethers.parseEther(reqValue),
        reqRecipient,
        reqCategory,
        false
      );
      const receipt = await tx.wait();

      // Parse RequestCreated event
      const iface = contract.interface;
      const requestCreatedLog = receipt.logs
        .map(log => { try { return iface.parseLog(log); } catch { return null; } })
        .find(parsed => parsed?.name === 'RequestCreated');
      const requestIndex = requestCreatedLog ? Number(requestCreatedLog.args.requestId) : Number(await contract.getRequestCount(parseInt(selectedCampaign))) - 1;

      await apiPost("/spending-requests", {
        campaignId: parseInt(selectedCampaign), requestIndex,
        description: reqDesc, value: reqValue, recipient: reqRecipient,
        category: reqCategory, currency: "ETH", txHash: receipt.hash,
      });
      toast.success("Spending request created! Donors can now vote.");
      setReqDesc(""); setReqValue(""); setReqRecipient(user?.walletAddress || ""); setReqCategory("Other");
      loadMyCampaigns();
    } catch (err) {
      console.error(err);
      toast.error("Failed: " + (err.reason || err.message));
    } finally { setCreatingReq(false); }
  };

  /* ── Computed values for hero stats ── */
  const totalRaised = user?.role === "charity"
    ? Object.values(chainData).reduce((sum, cd) => sum + parseFloat(cd.raised || 0), 0).toFixed(4)
    : myDonations.reduce((s, d) => s + parseFloat(d.amount || 0), 0).toFixed(4);
  const activeCampaignCount = user?.role === "charity"
    ? myCampaigns.filter(c => { const s = getCampaignStatus(chainData[c.smartContractId]); return s?.key === 'active'; }).length
    : [...new Set(myDonations.map(d => d.campaignId))].length;
  const pendingRequestCount = user?.role === "charity"
    ? Object.values(chainData).reduce((sum, cd) => sum + (cd.requests || 0), 0)
    : myDonations.length;

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loginPrompt}>
          <div className={styles.loginIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <p className={styles.loginText}>Please login to access your dashboard</p>
          <Link to="/login" className={styles.loginBtn}>Sign In</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.container}><SkeletonCard /><SkeletonCard /></div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Command Center</h1>
        <div className={styles.badges}>
          <span className={styles.welcomeText}>Welcome, {user.fullName}</span>
          <span className={`${styles.roleBadge} ${user.role === "charity" ? styles.roleBadgeCharity : styles.roleBadgeDonor}`}>
            {user.role === "charity" ? "Charity Organisation" : "Donor"}
          </span>
          <span className={styles.walletBadge}>{shortenAddress(user.walletAddress)}</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div className={styles.heroStats}>
        <div className={styles.heroStatCard}>
          <div className={styles.heroStatTop}>
            <div className={styles.heroStatIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
          <div className={styles.heroStatValue}>{totalRaised} ETH</div>
          <div className={styles.heroStatLabel}>{user.role === "charity" ? "Total Raised" : "Total Donated"}</div>
          <svg className={styles.sparkline} viewBox="0 0 100 40" preserveAspectRatio="none">
            <polyline points="0,35 15,28 30,32 45,20 60,24 75,12 90,8 100,15" fill="none" stroke="var(--color-primary)" strokeWidth="2"/>
          </svg>
        </div>
        <div className={styles.heroStatCard}>
          <div className={styles.heroStatTop}>
            <div className={styles.heroStatIconFire}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            </div>
          </div>
          <div className={styles.heroStatValue}>{activeCampaignCount}</div>
          <div className={styles.heroStatLabel}>{user.role === "charity" ? "Active Campaigns" : "Campaigns Supported"}</div>
        </div>
        <div className={styles.heroStatCard}>
          <div className={styles.heroStatTop}>
            <div className={styles.heroStatIconAlert}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            </div>
          </div>
          <div className={styles.heroStatValue}>{pendingRequestCount}</div>
          <div className={styles.heroStatLabel}>{user.role === "charity" ? "Spending Requests" : "Transactions"}</div>
        </div>
      </div>

      {/* ---- CHARITY DASHBOARD ---- */}
      {user.role === "charity" && (
        <>
          <div className={styles.tabBar} role="tablist" aria-label="Charity dashboard sections">
            <button role="tab" aria-selected={charityTab === "create"} className={`${styles.tabBtn} ${charityTab === "create" ? styles.active : ""}`} onClick={() => setCharityTab("create")}>Create Campaign</button>
            <button role="tab" aria-selected={charityTab === "campaigns"} className={`${styles.tabBtn} ${charityTab === "campaigns" ? styles.active : ""}`} onClick={() => setCharityTab("campaigns")}>My Campaigns ({myCampaigns.length})</button>
            {myCampaigns.length > 0 && (
              <button role="tab" aria-selected={charityTab === "requests"} className={`${styles.tabBtn} ${charityTab === "requests" ? styles.active : ""}`} onClick={() => setCharityTab("requests")}>Spending Requests</button>
            )}
          </div>

          {/* Create Campaign Tab */}
          {charityTab === "create" && (
            <div className={styles.section} role="tabpanel">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </div>
                <h3 className={styles.sectionTitle}>Launch New Campaign</h3>
              </div>
              <p className={styles.sectionSubtitle}>
                Creates an immutable record on Polygon-compatible blockchain. All donations tracked transparently.
              </p>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="camp-title" className={styles.label}>Campaign Title</label>
                  <input id="camp-title" className={styles.input} placeholder="e.g. Clean Water for Rural Kenya" value={title}
                    onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className={styles.formGridCols}>
                  <div className={styles.formGroup}>
                    <label htmlFor="camp-goal" className={styles.label}>Goal (ETH)</label>
                    <input id="camp-goal" className={styles.input} placeholder="e.g. 10" value={goal}
                      onChange={(e) => setGoal(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="camp-min" className={styles.label}>Min. Donation (ETH)</label>
                    <input id="camp-min" className={styles.input} placeholder="0.01" value={minContribution}
                      onChange={(e) => setMinContribution(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="camp-cat" className={styles.label}>Category</label>
                    <select id="camp-cat" className={styles.input} value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="General">General</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Education">Education</option>
                      <option value="Environment">Environment</option>
                      <option value="Disaster Relief">Disaster Relief</option>
                      <option value="Poverty">Poverty</option>
                      <option value="Animals">Animals</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="camp-deadline" className={styles.label}>Deadline (days, 0 = none)</label>
                    <input id="camp-deadline" className={styles.input} placeholder="e.g. 30" value={deadlineDays}
                      onChange={(e) => setDeadlineDays(e.target.value)} />
                  </div>
                </div>

                {/* AI Campaign Creator Module */}
                <div className={styles.aiModule}>
                  <div className={styles.aiModuleHeader}>
                    <span className={styles.aiIconPulse}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zM9 4L6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
                    </span>
                    <span className={styles.aiModuleTitle}>AI Campaign Creator</span>
                  </div>
                  <div className={styles.descriptionRow}>
                    <label htmlFor="camp-desc" className={styles.label} style={{marginBottom: 0}}>Description</label>
                    <button type="button" onClick={handleAiGenerate} disabled={aiLoading || !title} className={styles.aiButton}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zM9 4L6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
                      {aiLoading ? "Generating..." : "Generate with AI"}
                    </button>
                  </div>
                  <textarea id="camp-desc" className={styles.input} placeholder="Describe your campaign and how the funds will be used..."
                    value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
                </div>

                {/* AI Result Preview */}
                {aiResult && (
                  <div className={styles.aiResult}>
                    <div className={styles.aiResultHeader}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-secondary)"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zM9 4L6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z"/></svg>
                      <span className={styles.aiResultTitle}>AI Analysis</span>
                      {aiResult.trustScore && (
                        <span className={`${styles.trustBadge} ${
                          aiResult.trustScore >= 7 ? styles.trustHigh :
                          aiResult.trustScore >= 4 ? styles.trustMedium : styles.trustLow
                        }`}>
                          Trust Score: {aiResult.trustScore}/10
                        </span>
                      )}
                    </div>
                    {aiResult.analysis && (
                      <p className={styles.aiAnalysisText}>{aiResult.analysis}</p>
                    )}
                    <p className={styles.aiDisclaimer}>
                      AI-generated content is advisory. Review and edit before publishing.
                    </p>
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label htmlFor="camp-image" className={styles.label}>Campaign Image (optional)</label>
                  <input id="camp-image" type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className={styles.fileInput} />
                </div>

                {/* Phased Milestones */}
                <div className={`${styles.phasesContainer} ${showPhases ? "" : styles.disabled}`}>
                  <div className={styles.phasesHeader}>
                    <div>
                      <span className={styles.phasesTitle}>Phased Milestones</span>
                      <span className={styles.phasesSubtext}>
                        (auto-triggers spending requests when funded)
                      </span>
                    </div>
                    <button type="button"
                      className={showPhases ? styles.phaseToggleBtnActive : styles.phaseToggleBtn}
                      onClick={() => { setShowPhases(!showPhases); if (!showPhases && phases.length === 0) addPhase(); }}>
                      {showPhases ? "Disable Phases" : "Enable Phases"}
                    </button>
                  </div>

                  {showPhases && (
                    <div style={{ marginTop: "14px" }}>
                      {phases.map((phase, i) => (
                        <div key={i} className={styles.phaseRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Phase {i + 1} Description</label>
                            <input className={styles.input} placeholder="e.g. Foundation & groundwork"
                              value={phase.description} onChange={(e) => updatePhase(i, "description", e.target.value)} />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Cumulative Target (ETH)</label>
                            <input className={styles.input} placeholder={i === 0 ? "e.g. 3" : `> ${phases[i-1]?.target || "prev"}`}
                              value={phase.target} onChange={(e) => updatePhase(i, "target", e.target.value)} />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Vendor Wallet</label>
                            <input className={styles.input} placeholder="0x..."
                              value={phase.vendor} onChange={(e) => updatePhase(i, "vendor", e.target.value)} />
                          </div>
                          <button type="button" onClick={() => removePhase(i)}
                            className={styles.removePhaseBtn} title="Remove phase">&times;</button>
                        </div>
                      ))}
                      <button type="button" onClick={addPhase} className={styles.addPhaseBtn}>
                        + Add Phase
                      </button>
                      {goal && phases.length > 0 && (
                        <p className={styles.phaseNote}>
                          Final phase target must equal campaign goal ({goal} ETH).
                          Targets are cumulative -- e.g. Phase 1: 3 ETH, Phase 2: 7 ETH, Phase 3: {goal} ETH.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button className={styles.submitBtn} onClick={createCampaign} disabled={creating}>
                {creating ? "Publishing to Blockchain..." : "Publish Campaign"}
              </button>
            </div>
          )}

          {/* My Campaigns Tab */}
          {charityTab === "campaigns" && (
            <div className={styles.section} role="tabpanel">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
                <h3 className={styles.sectionTitle}>My Campaigns</h3>
              </div>
              {myCampaigns.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <p className={styles.emptyText}>No campaigns yet.</p>
                  <button className={styles.emptyBtn} onClick={() => setCharityTab("create")}>Create Your First Campaign</button>
                </div>
              ) : (
                <div className={styles.campaignGrid}>
                  {myCampaigns.map((c) => {
                    const cd = chainData[c.smartContractId];
                    const status = getCampaignStatus(cd);
                    return (
                      <div key={c._id} className={styles.campaignCard}>
                        <div className={styles.campaignHeader}>
                          <div className={styles.campaignTitleRow}>
                            <span className={styles.campaignTitle}>{c.title}</span>
                            <span className={styles.campaignIdBadge}>ID: {c.smartContractId}</span>
                            {status && (
                              <span className={`${styles.statusBadge} ${status.key === 'active' ? styles.statusActive : styles.statusEnded}`}>
                                {status.label}
                              </span>
                            )}
                          </div>
                          <Link to={`/campaign/${c.smartContractId}`} className={styles.viewBoardBtn}>
                            View Board <span className={styles.chevronIcon}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </span>
                          </Link>
                        </div>
                        {cd && (
                          <>
                            <ProgressBar raised={cd.raised} goal={cd.target} />
                            <div className={styles.campaignStatsRow}>
                              <span><strong className={styles.statHighlightText}>{cd.donors}</strong> donors</span>
                              <span><strong className={styles.statHighlightText}>{cd.requests}</strong> requests</span>
                              <span><strong className={styles.statPrimary}>{cd.disbursed} ETH</strong> released</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Spending Requests Tab */}
          {charityTab === "requests" && myCampaigns.length > 0 && (
            <div className={styles.section} role="tabpanel">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                </div>
                <h3 className={styles.sectionTitle}>Create Spending Request</h3>
              </div>
              <p className={styles.sectionSubtitle}>
                Categorise your spending so donors can see exactly where funds go -- the #1 trust driver.
                Funds are auto-released when &gt;50% of donors approve.
              </p>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="req-campaign" className={styles.label}>Select Campaign</label>
                  <select id="req-campaign" className={styles.input} value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
                    <option value="">-- Choose a campaign --</option>
                    {myCampaigns.map((c) => (
                      <option key={c.smartContractId} value={c.smartContractId}>
                        {c.title} (ID: {c.smartContractId})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="req-desc" className={styles.label}>What will the funds be used for?</label>
                  <input id="req-desc" className={styles.input} placeholder="e.g. Purchase medical supplies for clinic"
                    value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} />
                </div>

                <div className={styles.reqFormRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="req-value" className={styles.label}>Amount (ETH)</label>
                    <input id="req-value" className={styles.input} placeholder="e.g. 2.5" value={reqValue}
                      onChange={(e) => setReqValue(e.target.value)} />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="req-cat" className={styles.label}>Spending Category</label>
                    <select id="req-cat" className={styles.input} value={reqCategory} onChange={(e) => setReqCategory(e.target.value)}>
                      {SPEND_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="req-recipient" className={styles.label}>Recipient Wallet <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(defaults to yours)</span></label>
                    <input id="req-recipient" className={styles.input} placeholder="0x..." value={reqRecipient}
                      onChange={(e) => setReqRecipient(e.target.value)} />
                  </div>
                </div>
              </div>

              <button className={styles.submitBtn} onClick={createSpendingRequest} disabled={creatingReq}>
                {creatingReq ? "Submitting to Blockchain..." : "Submit Spending Request"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ---- DONOR DASHBOARD ---- */}
      {user.role === "donor" && (
        <>
          <div className={styles.tabBar} role="tablist" aria-label="Donor dashboard sections">
            <button role="tab" aria-selected={donorTab === "overview"} className={`${styles.tabBtn} ${donorTab === "overview" ? styles.active : ""}`} onClick={() => setDonorTab("overview")}>Overview</button>
            <button role="tab" aria-selected={donorTab === "actions"} className={`${styles.tabBtn} ${donorTab === "actions" ? styles.active : ""}`} onClick={() => setDonorTab("actions")}>Quick Actions</button>
            <button role="tab" aria-selected={donorTab === "history"} className={`${styles.tabBtn} ${donorTab === "history" ? styles.active : ""}`} onClick={() => setDonorTab("history")}>Recent Donations ({myDonations.length})</button>
          </div>

          {donorTab === "overview" && (
            <div role="tabpanel">
              <div className={styles.bentoGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statCardIconPrimary}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <div className={styles.statCardValuePrimary}>
                    {myDonations.reduce((s, d) => s + parseFloat(d.amount || 0), 0).toFixed(4)} ETH
                  </div>
                  <div className={styles.statCardLabel}>Total Donated</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statCardIconSecondary}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <div className={styles.statCardValueSecondary}>{myDonations.length}</div>
                  <div className={styles.statCardLabel}>Transactions</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statCardIconAccent}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  </div>
                  <div className={styles.statCardValueAccent}>
                    {[...new Set(myDonations.map(d => d.campaignId))].length}
                  </div>
                  <div className={styles.statCardLabel}>Campaigns Supported</div>
                </div>
              </div>

              {myDonations.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <p className={styles.emptyText}>No donations yet</p>
                  <Link to="/" className={styles.emptyBtn}>Browse Campaigns</Link>
                </div>
              )}
            </div>
          )}

          {donorTab === "actions" && (
            <div className={styles.section} role="tabpanel">
              <div className={styles.sectionHeader}>
                <div className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <h3 className={styles.sectionTitle}>Quick Actions</h3>
              </div>
              <div className={styles.actionGrid}>
                <Link to="/" className={styles.actionCard}>
                  <div className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <strong className={styles.actionTitle}>Browse Campaigns</strong>
                  <p className={styles.actionDesc}>Find causes to support</p>
                </Link>
                <Link to="/my-donations" className={styles.actionCard}>
                  <div className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <strong className={styles.actionTitle}>Donation History</strong>
                  <p className={styles.actionDesc}>Blockchain-verified receipts</p>
                </Link>
                <Link to="/transparency" className={styles.actionCard}>
                  <div className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  </div>
                  <strong className={styles.actionTitle}>Transparency Board</strong>
                  <p className={styles.actionDesc}>Platform-wide statistics</p>
                </Link>
                <Link to="/analytics" className={styles.actionCard}>
                  <div className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  </div>
                  <strong className={styles.actionTitle}>Analytics</strong>
                  <p className={styles.actionDesc}>Data-driven insights</p>
                </Link>
              </div>
            </div>
          )}

          {donorTab === "history" && (
            <div className={styles.section} role="tabpanel">
              <div className={styles.historyHeader}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <h3 className={styles.sectionTitle}>Recent Donations</h3>
                </div>
                <Link to="/my-donations" className={styles.viewAllBtn}>View All &rarr;</Link>
              </div>
              {myDonations.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>No donations yet. Browse campaigns to make your first contribution!</p>
                </div>
              ) : (
                myDonations.slice(0, 10).map((d, i) => (
                  <div key={i} className={styles.historyRow}>
                    <div>
                      <Link to={`/campaign/${d.campaignId}`} className={styles.historyLink}>
                        Campaign #{d.campaignId}
                      </Link>
                      <div className={styles.historyDate}>{new Date(d.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <span className={styles.historyAmount}>{d.amount} {d.currency || "ETH"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
