"use client";
// components/jars/TipBanner.tsx

import Icon from "@/components/Icon";

export default function TipBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="tip">
      <div className="tip-i">
        <Icon name="shield" size={18} />
      </div>
      <div className="tip-text">
        <b>Tip:</b> Log your income regularly to keep your jars balanced and stay on track with your goals.
      </div>
      <div className="tip-actions">
        <button className="btn btn-secondary" style={{ padding: "7px 14px", fontSize: 12.5 }}>
          Learn More
        </button>
        <button className="tip-x" onClick={onDismiss}>
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
