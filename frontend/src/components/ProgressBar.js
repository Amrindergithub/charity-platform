export default function ProgressBar({ raised, goal, label }) {
  const raisedNum = parseFloat(raised) || 0;
  const goalNum = parseFloat(goal) || 1;
  const percent = Math.min((raisedNum / goalNum) * 100, 100);
  const isComplete = percent >= 100;

  return (
    <div className="progress-container">
      {label && <div style={{ fontSize: "12px", color: "var(--color-text-muted, #E4BEB1)", marginBottom: "4px" }}>{label}</div>}
      <div className="progress-bar-bg" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label={label || `${percent.toFixed(1)}% funded`}>
        <div
          className={`progress-bar-fill ${isComplete ? "complete" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "12px", color: "var(--color-text-muted, #9A8A83)", marginTop: "6px"
      }}>
        <span style={{ fontWeight: 600, color: "var(--color-text, #E5E2E1)" }}>{raisedNum.toFixed(4)} ETH</span>
        <span style={{ color: "var(--color-primary, #FFB59A)", fontWeight: 600 }}>{percent.toFixed(1)}%</span>
        <span>Goal: {goalNum} ETH</span>
      </div>
    </div>
  );
}
