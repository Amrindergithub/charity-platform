import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost, setAuthToken, web3Login } from "../utils/ethereum";
import { useToast } from "../components/Toast";
import styles from "./Auth.module.css";

export default function Login({ setLoggedInUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiPost("/login", { email, password });
      if (data.success) {
        setAuthToken(data.token);
        toast.success("Welcome back, " + data.user.fullName + "!");
        setLoggedInUser(data.user);
        navigate("/");
      } else {
        toast.error("Login Failed: " + data.message);
      }
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWeb3Login = async () => {
    if (!window.ethereum) {
      toast.error("MetaMask not detected. Please install the MetaMask extension.");
      return;
    }
    setWalletLoading(true);
    try {
      const data = await web3Login();
      if (data.token) {
        toast.success("Wallet connected! Welcome, " + (data.user.fullName || "User") + "!");
        setLoggedInUser(data.user);
        navigate("/");
      } else {
        toast.error("Web3 login failed: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      if (err.code === 4001) {
        toast.warning("Signature request was rejected.");
      } else {
        toast.error("Web3 Login Error: " + err.message);
      }
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.authContent}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.brandTitle}>TrustChain</h1>
            <p className={styles.subtitle}>Sign in to access your Web3 portfolio</p>
          </div>

          {/* Email / Password Form */}
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="login-email" className={styles.label}>Email</label>
              <input
                id="login-email"
                className={styles.input}
                placeholder="you@example.com"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="login-password" className={styles.label}>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="login-password"
                  className={styles.input}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          {/* Divider */}
          <div className={styles.divider}>
            <div className={styles.dividerLine} />
            <span className={styles.dividerText}>or</span>
            <div className={styles.dividerLine} />
          </div>

          {/* MetaMask Login */}
          <button
            onClick={handleWeb3Login}
            disabled={walletLoading}
            className={styles.web3Button}
          >
            <span className="material-symbols-outlined">account_balance_wallet</span>
            {walletLoading ? "Connecting Wallet..." : "Sign in with MetaMask"}
          </button>

          <p className={styles.footer}>
            Don't have an account?{" "}
            <Link to="/register" className={styles.link}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
