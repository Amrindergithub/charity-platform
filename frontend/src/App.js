import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { restoreSession, clearAuthToken } from "./utils/ethereum";
import ErrorBoundary from "./components/ErrorBoundary";
import PrivateRoute from "./components/PrivateRoute";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CampaignDetail from "./pages/CampaignDetail";
import MyDonations from "./pages/MyDonations";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import "./App.css";

const Analytics = lazy(() => import("./pages/Analytics"));
const MarketData = lazy(() => import("./pages/MarketData"));
const TransparencyDashboard = lazy(() => import("./pages/TransparencyDashboard"));

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Restore session from JWT on page load
  useEffect(() => {
    restoreSession().then(user => {
      if (user) setLoggedInUser(user);
      setSessionLoading(false);
    });
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setLoggedInUser(null);
  };

  if (sessionLoading) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        height: "100vh", color: "var(--gray-400)", fontSize: "16px"
      }}>
        Loading TrustChain...
      </div>
    );
  }

  return (
    <ToastProvider>
      <Router>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Navbar user={loggedInUser} onLogout={handleLogout} />
          <div id="main-content" style={{ flex: 1 }}>
            <ErrorBoundary>
            <Suspense fallback={<div style={{display:'flex',justifyContent:'center',padding:'60px',color:'var(--gray-400)'}}>Loading...</div>}>
            <Routes>
              <Route path="/" element={<Home user={loggedInUser} />} />
              <Route path="/login" element={loggedInUser ? <Navigate to="/dashboard" replace /> : <Login setLoggedInUser={setLoggedInUser} />} />
              <Route path="/register" element={loggedInUser ? <Navigate to="/dashboard" replace /> : <Register />} />
              <Route path="/dashboard" element={
                <PrivateRoute user={loggedInUser}>
                  <Dashboard user={loggedInUser} />
                </PrivateRoute>
              } />
              <Route path="/campaign/:id" element={<CampaignDetail user={loggedInUser} />} />
              <Route path="/transparency" element={<TransparencyDashboard />} />
              <Route path="/my-donations" element={
                <PrivateRoute user={loggedInUser} requiredRole="donor">
                  <MyDonations user={loggedInUser} />
                </PrivateRoute>
              } />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/market-data" element={<MarketData />} />
              <Route path="/profile" element={
                <PrivateRoute user={loggedInUser}>
                  <Profile user={loggedInUser} setLoggedInUser={setLoggedInUser} />
                </PrivateRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </div>
          <Footer />
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
