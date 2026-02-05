import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { connectWallet, apiPost } from "../utils/ethereum";
import { useToast } from "../components/Toast";
import styles from "./Auth.module.css";

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", walletAddress: "", role: "donor"
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleConnect = async () => {
    const addr = await connectWallet();
    if (addr) {
      setFormData({ ...formData, walletAddress: addr });
      toast.success("Wallet connected!");
    } else {
      toast.error("Could not connect wallet. Is MetaMask installed?");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.walletAddress) {
      toast.warning("Please connect your MetaMask wallet first!");
      return;
    }
    if (formData.password.length < 6) {
      toast.warning("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/register", formData);
      toast.success("Account created! Please login.");
      navigate("/login");
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard} style={{ maxWidth: 560 }}>
        <div className={styles.authContent}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.title}>
              Initialize <span className={styles.titleAccent}>Node</span>
            </h1>
            <p className={styles.subtitle}>
              Establish your presence on the Celestial Ledger
            </p>
          </div>

          {/* Role Selector */}
          <div className={styles.roleSelector}>
            <div
              className={`${styles.roleCard} ${formData.role === "donor" ? styles.roleCardActive : ""}`}
              onClick={() => setFormData({ ...formData, role: "donor" })}
              role="button"
              tabIndex={0}
              aria-pressed={formData.role === "donor"}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setFormData({ ...formData, role: "donor" }); }}
            >
              <span className={`material-symbols-outlined ${styles.roleIcon}`}>volunteer_activism</span>
              <p className={styles.roleTitle}>Donor Entity</p>
              <p className={styles.roleDesc}>Donate to campaigns and vote on spending proposals</p>
            </div>

            <div
              className={`${styles.roleCard} ${formData.role === "charity" ? styles.roleCardActive : ""}`}
              onClick={() => setFormData({ ...formData, role: "charity" })}
              role="button"
              tabIndex={0}
              aria-pressed={formData.role === "charity"}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setFormData({ ...formData, role: "charity" }); }}
            >
              <span className={`material-symbols-outlined ${styles.roleIcon}`}>account_balance</span>
              <p className={styles.roleTitle}>Charity Protocol</p>
              <p className={styles.roleDesc}>Launch campaigns and manage transparent spending</p>
            </div>
          </div>

          {/* Registration Form */}
          <div className={styles.formCard}>
            <p className={styles.sectionTitle}>Identity Genesis</p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="reg-name" className={styles.label}>Full Name</label>
                <input
                  id="reg-name"
                  className={styles.input}
                  placeholder="Enter your full name"
                  required
                  autoComplete="name"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="reg-email" className={styles.label}>Email</label>
                <input
                  id="reg-email"
                  className={styles.input}
                  placeholder="you@example.com"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="reg-password" className={styles.label}>Password</label>
                <input
                  id="reg-password"
                  className={styles.input}
                  placeholder="Create a password (min 6 chars)"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={formData.password}
                  minLength={6}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              {/* Wallet Connection */}
              <div className={styles.formGroup}>
                <label className={styles.label} id="wallet-label">Web3 Wallet</label>
                {!formData.walletAddress ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className={styles.walletBtnGlass}
                    aria-describedby="wallet-label"
                  >
                    <span className="material-symbols-outlined">account_balance_wallet</span>
                    Connect Wallet
                  </button>
                ) : (
                  <div className={styles.walletConnected} role="status" aria-label="Wallet connected">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
                    <span className={styles.walletAddress}>
                      {formData.walletAddress.substring(0, 6)}...{formData.walletAddress.substring(38)}
                    </span>
                  </div>
                )}
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? "Establishing Node..." : "Establish Node"}
              </button>
            </form>
          </div>

          <p className={styles.footer}>
            Already have an account?{" "}
            <Link to="/login" className={styles.link}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
