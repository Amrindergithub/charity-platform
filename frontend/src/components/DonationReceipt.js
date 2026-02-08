import { shortenAddress } from "../utils/ethereum";

export default function DonationReceipt({ donation, campaignTitle, onClose }) {
  const handlePrint = () => window.print();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}
        style={{ maxWidth: "520px" }} id="receipt">
        {/* Header */}
        <div style={{
          textAlign: "center", borderBottom: "1px solid rgba(91, 65, 55, 0.2)",
          paddingBottom: "16px", marginBottom: "20px"
        }}>
          <span className="material-symbols-outlined" style={{
            fontSize: "32px",
            color: "var(--color-primary, #FFB59A)",
            marginBottom: "8px",
            display: "block",
          }}>verified</span>
          <h2 style={{
            margin: "0 0 4px 0",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--color-text, #E5E2E1)",
            fontFamily: "var(--font-headline, 'Space Grotesk', sans-serif)",
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
          }}>Donation Receipt</h2>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted, #9A8A83)" }}>
            Blockchain-Verified &middot; Immutable Record
          </p>
        </div>

        {/* Details */}
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={rowStyle}>
            <span style={labelStyle}>Campaign</span>
            <span style={valueStyle}>{campaignTitle || `Campaign #${donation.campaignId}`}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Amount</span>
            <span style={{ ...valueStyle, color: "var(--color-primary, #FFB59A)", fontWeight: 700 }}>
              {donation.amount} {donation.currency || "ETH"}
            </span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Date</span>
            <span style={valueStyle}>{new Date(donation.createdAt).toLocaleString()}</span>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Donor</span>
            <span style={{
              ...valueStyle,
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "12px",
            }}>
              {donation.donorName && `${donation.donorName} · `}
              {shortenAddress(donation.donorWallet)}
            </span>
          </div>
          <div style={{ ...rowStyle, flexDirection: "column", gap: "4px" }}>
            <span style={labelStyle}>Transaction Hash</span>
            <code style={{
              fontSize: "11px",
              wordBreak: "break-all",
              color: "var(--color-text-muted, #9A8A83)",
              background: "rgba(91, 65, 55, 0.08)",
              padding: "8px 12px",
              borderRadius: "8px",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              border: "1px solid rgba(91, 65, 55, 0.1)",
            }}>
              {donation.txHash}
            </code>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "24px" }}>
          <button style={{
            padding: "10px 24px",
            borderRadius: "var(--radius, 12px)",
            border: "1px solid rgba(91, 65, 55, 0.2)",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            background: "transparent",
            color: "var(--color-text, #E5E2E1)",
            fontFamily: "var(--font-body, 'Inter', sans-serif)",
          }} onClick={onClose}>Close</button>
          <button style={{
            padding: "10px 24px",
            borderRadius: "var(--radius, 12px)",
            border: "none",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            background: "#FF5C00",
            color: "#fff",
            fontFamily: "var(--font-body, 'Inter', sans-serif)",
          }} onClick={handlePrint}>Print Receipt</button>
        </div>
      </div>
    </div>
  );
}

const rowStyle = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "8px 0", borderBottom: "1px solid rgba(91, 65, 55, 0.1)"
};
const labelStyle = {
  fontSize: "13px",
  color: "var(--color-text-muted, #9A8A83)",
  fontWeight: 500,
};
const valueStyle = {
  fontSize: "14px",
  color: "var(--color-text, #E5E2E1)",
  fontWeight: 600,
};
