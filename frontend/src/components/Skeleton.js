export function Skeleton({ width = "100%", height = "20px", borderRadius = "8px", style = {} }) {
  return (
    <div className="skeleton" style={{ width, height, borderRadius, ...style }} />
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: "var(--surface-container-lowest, #0E0E0E)",
      border: "1px solid rgba(91, 65, 55, 0.15)",
      borderRadius: "var(--radius, 12px)",
      padding: "24px",
      overflow: "hidden",
    }}>
      <Skeleton height="160px" width="100%" borderRadius="8px" style={{ marginBottom: "16px" }} />
      <Skeleton height="14px" width="40%" style={{ marginBottom: "16px" }} />
      <Skeleton height="10px" width="80%" style={{ marginBottom: "8px" }} />
      <Skeleton height="10px" width="60%" style={{ marginBottom: "20px" }} />
      <Skeleton height="8px" width="100%" style={{ marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "16px" }}>
        <Skeleton height="10px" width="80px" />
        <Skeleton height="10px" width="80px" />
        <Skeleton height="10px" width="80px" />
      </div>
    </div>
  );
}

export function SkeletonStats({ count = 4 }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card" style={{ padding: "24px" }}>
          <Skeleton height="28px" width="28px" borderRadius="50%" style={{ margin: "0 auto 12px auto" }} />
          <Skeleton height="22px" width="60%" style={{ margin: "0 auto 8px auto" }} />
          <Skeleton height="10px" width="80%" style={{ margin: "0 auto" }} />
        </div>
      ))}
    </div>
  );
}
