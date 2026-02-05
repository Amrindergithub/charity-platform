import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { shortenAddress } from "../utils/ethereum";
import styles from "./Navbar.module.css";

export default function Navbar({ user, onLogout }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [networkOk, setNetworkOk] = useState(false);

  const isActive = (path) => location.pathname === path;

  // Check Ganache connection
  useEffect(() => {
    const check = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: "eth_chainId" });
          setNetworkOk(chainId === "0x1691" || chainId === "0x539"); // 5777 or 1337
        } catch { setNetworkOk(false); }
      }
    };
    check();
    if (window.ethereum) {
      window.ethereum.on("chainChanged", check);
      return () => window.ethereum.removeListener("chainChanged", check);
    }
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  // Escape key closes menu
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    if (menuOpen) {
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [menuOpen]);

  const navClass = (path) => `${styles.navItem} ${isActive(path) ? styles.navItemActive : ""}`;

  return (
    <nav className={styles.header}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandText}>TrustChain</span>
        <div
          className={`${styles.networkDot} ${networkOk ? styles.networkOnline : styles.networkOffline}`}
          title={networkOk ? "Connected to Network" : "Network Error"}
        />
      </Link>

      {/* Hamburger button (mobile) */}
      <button className={styles.hamburgerBtn} onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu" aria-expanded={menuOpen}>
        <span className={styles.hamburgerLine} style={{ transform: menuOpen ? "rotate(45deg) translateY(6px)" : "none" }} />
        <span className={styles.hamburgerLine} style={{ opacity: menuOpen ? 0 : 1 }} />
        <span className={styles.hamburgerLine} style={{ transform: menuOpen ? "rotate(-45deg) translateY(-6px)" : "none" }} />
      </button>

      <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ""}`}>
        <div className={styles.navGroup}>
          <Link to="/" className={navClass("/")}>Campaigns</Link>
          <Link to="/transparency" className={navClass("/transparency")}>Transparency</Link>
          <Link to="/analytics" className={navClass("/analytics")}>Analytics</Link>
          <Link to="/market-data" className={navClass("/market-data")}>Market Data</Link>
        </div>

        {!user ? (
          <Link to="/login" className={styles.primaryPill}>
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            Get Started
          </Link>
        ) : (
          <div className={styles.userArea}>
            <Link to="/dashboard" className={navClass("/dashboard")}>Dashboard</Link>
            {user.role === "donor" && (
              <Link to="/my-donations" className={navClass("/my-donations")}>My Donations</Link>
            )}

            <div className={styles.userSection}>
              <button onClick={onLogout} className={styles.logoutBtn} title="Logout">
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>logout</span>
              </button>

              <Link to="/profile" className={styles.userInfo}>
                <div className={styles.avatar}>
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>person</span>
                </div>
              </Link>

              <div className={styles.walletPill}>
                <span className={`${styles.roleBadge} ${user.role === "charity" ? styles.roleCharity : styles.roleDonor}`}>
                  {user.role === "charity" ? "Charity" : "Donor"}
                </span>
                <span className={styles.walletAddress}>
                  {shortenAddress(user.walletAddress)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
