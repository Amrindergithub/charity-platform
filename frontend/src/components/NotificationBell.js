import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { apiFetch, apiPost } from "../utils/ethereum";
import styles from "./NotificationBell.module.css";

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef(null);

  const load = async () => {
    if (!user) return;
    try {
      const data = await apiFetch("/notifications");
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    if (!user) return;
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try {
        await apiPost("/notifications/mark-read", {});
        setUnread(0);
        setItems(prev => prev.map(n => ({ ...n, read: true })));
      } catch { /* silent */ }
    }
  };

  if (!user) return null;

  const formatTime = (d) => {
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const iconFor = (type) => {
    switch (type) {
      case "campaign_cancelled": return "cancel";
      case "refund_sent": return "payments";
      case "campaign_funded": return "celebration";
      case "spending_request": return "request_quote";
      default: return "notifications";
    }
  };

  return (
    <div className={styles.bellWrap} ref={dropdownRef}>
      <button className={styles.bellBtn} onClick={toggle} aria-label="Notifications">
        <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>notifications</span>
        {unread > 0 && <span className={styles.badge}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span>Notifications</span>
            <span className={styles.headerCount}>{items.length}</span>
          </div>
          <div className={styles.list}>
            {items.length === 0 ? (
              <div className={styles.empty}>
                <span className="material-symbols-outlined" style={{ fontSize: "32px", opacity: 0.4 }}>notifications_off</span>
                <p>No notifications yet</p>
              </div>
            ) : items.map(n => (
              <Link
                key={n._id}
                to={n.campaignId !== undefined ? `/campaign/${n.campaignId}` : "#"}
                className={`${styles.item} ${!n.read ? styles.itemUnread : ""}`}
                onClick={() => setOpen(false)}
              >
                <span className={`material-symbols-outlined ${styles.itemIcon}`}>{iconFor(n.type)}</span>
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{n.title}</div>
                  <div className={styles.itemMessage}>{n.message}</div>
                  <div className={styles.itemTime}>{formatTime(n.createdAt)} ago</div>
                </div>
                {!n.read && <span className={styles.unreadDot} />}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
