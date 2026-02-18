import { useState, useEffect } from "react";
import { apiPut, getReadOnlyContract, formatEth } from "../utils/ethereum";
import { useToast } from "../components/Toast";
import styles from "./Profile.module.css";

const TIER_LABELS = ["Unranked", "Observer", "Contributor", "Guardian", "Champion", "Legend"];
const TIER_COLORS = ["#666", "#A0A0A0", "#4FC3F7", "#66BB6A", "#FF9800", "#FF5C00"];

export default function Profile({ user, setLoggedInUser }) {
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [notifDonations, setNotifDonations] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(true);
  const [copied, setCopied] = useState(false);
  const [identity, setIdentity] = useState(null);
  const toast = useToast();

  // Fetch on-chain decentralised identity
  useEffect(() => {
    const fetchIdentity = async () => {
      if (!user?.walletAddress) return;
      try {
        const contract = await getReadOnlyContract();
        const [campaignsBacked, ethDonated, scDonated, votesCast, firstActivity, reputationScore] =
          await contract.getDonorIdentity(user.walletAddress);
        const tier = await contract.getReputationTier(user.walletAddress);
        setIdentity({
          campaignsBacked: Number(campaignsBacked),
          ethDonated: formatEth(ethDonated),
          scDonated: Number(scDonated),
          votesCast: Number(votesCast),
          firstActivity: Number(firstActivity),
          reputationScore: Number(reputationScore),
          tier: Number(tier)
        });
      } catch (err) {
        console.warn("Could not fetch on-chain identity:", err.message);
      }
    };
    fetchIdentity();
  }, [user?.walletAddress]);

  const updateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.warning("Name cannot be empty");
    setSaving(true);
    try {
      const data = await apiPut("/profile", { fullName });
      setLoggedInUser(prev => ({ ...prev, fullName: data.user.fullName }));
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.warning("Password must be at least 6 characters");
    setChangingPw(true);
    try {
      await apiPut("/change-password", { currentPassword, newPassword });
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setChangingPw(false);
    }
  };

  const copyWallet = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      toast.success("Wallet address copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDiscard = () => {
    setFullName(user?.fullName || "");
    setBio(user?.bio || "");
    setCurrentPassword("");
    setNewPassword("");
    toast.info("Changes discarded");
  };

  return (
    <div className={styles.page}>
      <div className={styles.layout}>

        {/* ── Left Column: User Card ── */}
        <div>
          <div className={styles.userCard}>
            <div className={styles.userCardOrb} />

            <div className={`${styles.avatarLarge} ${user?.role === "charity" ? styles.avatarCharity : ""}`}>
              {user?.fullName?.charAt(0)?.toUpperCase() || "?"}
            </div>

            <h2 className={styles.userName}>{user?.fullName || "Unknown"}</h2>
            <p className={styles.userRole}>
              {user?.role === "charity" ? "Charity Organisation" : "Donor"}
            </p>

            <div className={styles.tierBadge} style={identity ? { borderColor: TIER_COLORS[identity.tier] + '40' } : {}}>
              <span className={styles.tierDot} style={identity ? { background: TIER_COLORS[identity.tier] } : {}} />
              {identity ? TIER_LABELS[identity.tier] : (user?.role === "charity" ? "Verified Charity" : "Active Donor")}
            </div>

            <div className={styles.walletRow}>
              <span className={styles.walletAddr}>
                {user?.walletAddress || "Not connected"}
              </span>
              {user?.walletAddress && (
                <button
                  className={styles.walletCopyBtn}
                  onClick={copyWallet}
                  aria-label="Copy wallet address"
                >
                  <span className="material-symbols-outlined">
                    {copied ? "check" : "content_copy"}
                  </span>
                </button>
              )}
            </div>

            <p className={styles.memberSince}>
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "N/A"}
            </p>

            {/* On-Chain Identity Stats */}
            <div className={styles.statsBento}>
              <div className={styles.statBox}>
                <div className={styles.statBoxIcon}>
                  <span className="material-symbols-outlined">auto_graph</span>
                </div>
                <p className={styles.statBoxValue} style={identity ? { color: TIER_COLORS[identity.tier] } : {}}>
                  {identity ? identity.reputationScore : "--"}
                </p>
                <p className={styles.statBoxLabel}>Reputation Score</p>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxIcon}>
                  <span className="material-symbols-outlined">volunteer_activism</span>
                </div>
                <p className={styles.statBoxValue}>{identity ? identity.campaignsBacked : "--"}</p>
                <p className={styles.statBoxLabel}>Campaigns Backed</p>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxIcon}>
                  <span className="material-symbols-outlined">token</span>
                </div>
                <p className={styles.statBoxValue}>{identity ? `${identity.ethDonated}` : "--"}</p>
                <p className={styles.statBoxLabel}>ETH Donated</p>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxIcon}>
                  <span className="material-symbols-outlined">how_to_vote</span>
                </div>
                <p className={styles.statBoxValue}>{identity ? identity.votesCast : "--"}</p>
                <p className={styles.statBoxLabel}>Votes Cast</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: Edit Sections ── */}
        <div className={styles.rightCol}>

          <div className={styles.sectionHeader}>
            <h1 className={styles.sectionTitle}>Edit Profile</h1>
            <p className={styles.sectionDesc}>Manage your TrustChain ledger identity</p>
          </div>

          {/* Identity Management */}
          <form onSubmit={updateProfile}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={`material-symbols-outlined ${styles.cardIcon}`}>person_edit</span>
                <h3 className={styles.cardTitle}>Identity Management</h3>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="profile-name" className={styles.label}>Display Name</label>
                  <input
                    id="profile-name"
                    className={styles.input}
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="profile-email" className={styles.label}>Email</label>
                  <input
                    id="profile-email"
                    className={styles.inputReadonly}
                    value={user?.email || ""}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                  <label htmlFor="profile-bio" className={styles.label}>Bio</label>
                  <textarea
                    id="profile-bio"
                    className={styles.textarea}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Tell the community about yourself..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Action Footer for Identity */}
            <div className={styles.actionFooter}>
              <button type="button" className={styles.discardLink} onClick={handleDiscard}>
                Discard Changes
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={saving}>
                {saving ? "Syncing..." : "Sync Ledger Profile"}
              </button>
            </div>
          </form>

          {/* Security Protocol */}
          <form onSubmit={changePassword}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={`material-symbols-outlined ${styles.cardIcon}`}>key</span>
                <h3 className={styles.cardTitle}>Security Protocol</h3>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="current-pw" className={styles.label}>Current Password</label>
                  <input
                    id="current-pw"
                    className={styles.input}
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="new-pw" className={styles.label}>New Password</label>
                  <input
                    id="new-pw"
                    className={styles.input}
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                  />
                </div>
              </div>
            </div>
            <div className={styles.actionFooter}>
              <button type="submit" className={styles.secondaryBtn} disabled={changingPw}>
                {changingPw ? "Updating..." : "Update Security"}
              </button>
            </div>
          </form>

          {/* Communication */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={`material-symbols-outlined ${styles.cardIcon}`}>sensors</span>
              <h3 className={styles.cardTitle}>Communication</h3>
            </div>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Donation confirmations</span>
              <div
                className={notifDonations ? styles.toggleTrackOn : styles.toggleTrack}
                onClick={() => setNotifDonations(v => !v)}
                role="switch"
                aria-checked={notifDonations}
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNotifDonations(v => !v); }}}
              >
                <div className={notifDonations ? styles.toggleThumbOn : styles.toggleThumb} />
              </div>
            </div>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Campaign updates</span>
              <div
                className={notifUpdates ? styles.toggleTrackOn : styles.toggleTrack}
                onClick={() => setNotifUpdates(v => !v)}
                role="switch"
                aria-checked={notifUpdates}
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNotifUpdates(v => !v); }}}
              >
                <div className={notifUpdates ? styles.toggleThumbOn : styles.toggleThumb} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
