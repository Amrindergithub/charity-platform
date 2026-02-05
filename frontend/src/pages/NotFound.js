import { Link } from 'react-router-dom';
import styles from './Auth.module.css';

export default function NotFound() {
  return (
    <div className={styles.notFoundContainer}>
      <div className={styles.notFoundContent}>
        <p className={styles.notFound404}>404</p>
        <h1 className={styles.notFoundTitle}>Page Not Found</h1>
        <p className={styles.notFoundDesc}>
          The artifact you are searching for has drifted beyond the observable ledger.
        </p>
        <Link to="/" className={styles.notFoundBtn}>
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Campaigns
        </Link>
      </div>
    </div>
  );
}
