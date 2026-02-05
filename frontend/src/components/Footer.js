import { Link } from "react-router-dom";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.dividerLine} />

      {/* Main footer content */}
      <div className={styles.mainContent}>
        {/* Brand */}
        <div className={styles.brandColumn}>
          <div className={styles.brand}>
            <span className={styles.brandName}>Solar Nocturne</span>
          </div>
          <p className={styles.description}>
            A blockchain-based transparent charity donation platform with DAO governance.
            Every donation is immutable. Every spend is voter-approved.
          </p>
          <div className={styles.techStack}>
            <span className={styles.techBadge}>Solidity</span>
            <span className={styles.techBadge}>React</span>
            <span className={styles.techBadge}>Polygon</span>
            <span className={styles.techBadge}>Ethers.js</span>
          </div>
        </div>

        {/* Platform Links */}
        <div>
          <h4 className={styles.columnTitle}>Platform</h4>
          <div className={styles.linksList}>
            <Link to="/" className={styles.link}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>campaign</span>
              Browse Campaigns
            </Link>
            <Link to="/transparency" className={styles.link}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>visibility</span>
              Transparency Dashboard
            </Link>
            <Link to="/analytics" className={styles.link}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>analytics</span>
              Platform Analytics
            </Link>
            <Link to="/register" className={styles.link}>
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>person_add</span>
              Create Account
            </Link>
          </div>
        </div>

        {/* How It Works */}
        <div>
          <h4 className={styles.columnTitle}>How It Works</h4>
          <div className={styles.processList}>
            <div className={styles.processItem}>
              <span className={styles.processStep}>01</span>
              <span>Charities create campaigns recorded on the blockchain</span>
            </div>
            <div className={styles.processItem}>
              <span className={styles.processStep}>02</span>
              <span>Donors contribute ETH or stablecoins via MetaMask</span>
            </div>
            <div className={styles.processItem}>
              <span className={styles.processStep}>03</span>
              <span>Charities submit categorised spending requests</span>
            </div>
            <div className={styles.processItem}>
              <span className={styles.processStep}>04</span>
              <span>Donors vote &mdash; funds release only with &gt;50% approval</span>
            </div>
          </div>
        </div>

        {/* Research Context */}
        <div>
          <h4 className={styles.columnTitle}>Research Foundation</h4>
          <div className={styles.researchList}>
            <div className={styles.researchItem}>
              <div className={`${styles.researchItemTitle} ${styles.trust}`}>Trust Gap</div>
              <span>87% want financial visibility, only 57% feel they get it &mdash; Charity Commission, 2024</span>
            </div>
            <div className={styles.researchItem}>
              <div className={`${styles.researchItemTitle} ${styles.donor}`}>Donor Decline</div>
              <span>Only 50% of UK adults donated in 2024, an all-time low &mdash; CAF UK Giving, 2025</span>
            </div>
            <div className={styles.researchItem}>
              <div className={`${styles.researchItemTitle} ${styles.polygon}`}>Affordability</div>
              <span>Polygon reduces gas fees to ~$0.01, enabling micro-donations at scale</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className={styles.bottomBar}>
        <div className={styles.copyright}>
          &copy; {new Date().getFullYear()} TrustChain &mdash; BSc Computer Science Final Year Project, University of East London
        </div>
        <div className={styles.bottomBadges}>
          <span className={`${styles.statusBadge} ${styles.badgePolygon}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>hexagon</span>
            Built for Polygon
          </span>
          <span className={`${styles.statusBadge} ${styles.badgeChain}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>verified</span>
            Blockchain Verified
          </span>
        </div>
      </div>
    </footer>
  );
}
