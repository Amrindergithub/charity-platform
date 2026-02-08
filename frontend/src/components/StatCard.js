export default function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon">
        <span className="material-symbols-outlined" style={{ fontSize: "24px", color: color || "var(--color-primary, #FFB59A)" }}>
          {icon}
        </span>
      </div>
      <div className="stat-card-value" style={{ color: color || "var(--color-text, #E5E2E1)" }}>{value}</div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
