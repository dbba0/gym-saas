import { useEffect, useMemo, useState } from "react";
import type { AdminOnboardingData, OnboardingStep } from "./types";

type GymPreviewCardProps = {
  data: AdminOnboardingData;
  currentStep: OnboardingStep;
};

const BASE_MONTHLY_PRICE: Record<AdminOnboardingData["currency"], number> = {
  XOF: 20000,
  USD: 3900,
  EUR: 3500,
  CAD: 4900
};

export default function GymPreviewCard({ data, currentStep }: GymPreviewCardProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data.logoFile) {
      setLogoUrl(null);
      return;
    }
    const url = URL.createObjectURL(data.logoFile);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data.logoFile]);

  const adminName = [data.firstName, data.lastName].filter(Boolean).join(" ") || "Admin name";
  const location = [data.city, data.country].filter(Boolean).join(", ") || "City, Country";

  const simulated = useMemo(() => {
    const members = Math.max(0, Number(data.estimatedMembers) || 0);
    const coaches = Math.max(1, Number(data.estimatedCoaches) || 1);
    const plans = Math.max(1, data.subscriptionTypes.length);
    const planMixFactor = 0.58 + plans * 0.14;
    const monthlyRevenue = Math.round(members * BASE_MONTHLY_PRICE[data.currency] * planMixFactor);
    const coachLoad = Math.max(1, Math.round(members / coaches));
    const utilization = Math.min(96, Math.max(24, Math.round(35 + members / 6)));

    return {
      members,
      coaches,
      monthlyRevenue,
      coachLoad,
      utilization,
      bars: [0.62, 0.76, 0.88].map((ratio, index) => Math.max(22, Math.round(utilization * ratio - index * 6)))
    };
  }, [data.currency, data.estimatedCoaches, data.estimatedMembers, data.subscriptionTypes.length]);

  return (
    <aside className="onb-preview-card" aria-label="Live gym preview">
      <div
        className="onb-preview-banner"
        style={{ background: `linear-gradient(135deg, ${data.primaryColor || "#ff6b35"} 0%, #11141f 100%)` }}
      >
        <div>
          <p className="onb-preview-kicker">Live preview</p>
          <h3>{data.gymName || "Your gym name"}</h3>
          <p className="onb-preview-step">Current step: {currentStep + 1}</p>
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="onb-preview-logo" src={logoUrl} alt="Gym logo preview" />
        ) : (
          <div className="onb-preview-logo-fallback">Logo</div>
        )}
      </div>

      <div className="onb-preview-body">
        <div className="onb-preview-row">
          <span>Admin</span>
          <strong>{adminName}</strong>
        </div>
        <div className="onb-preview-row">
          <span>Email</span>
          <strong>{data.email || "owner@gym.com"}</strong>
        </div>
        <div className="onb-preview-row">
          <span>Phone</span>
          <strong>{data.gymPhone || data.phone || "+221 00 000 00 00"}</strong>
        </div>
        <div className="onb-preview-row">
          <span>Location</span>
          <strong>{location}</strong>
        </div>
        <div className="onb-preview-color-row">
          <span>Brand color</span>
          <div className="onb-preview-color-chip" style={{ backgroundColor: data.primaryColor || "#ff6b35" }}>
            {data.primaryColor || "#ff6b35"}
          </div>
        </div>
      </div>

      <div className="onb-preview-stats">
        <div className="onb-stat-mini">
          <span>Projected monthly</span>
          <strong>
            {(simulated.monthlyRevenue / 100).toLocaleString()} {data.currency}
          </strong>
        </div>
        <div className="onb-stat-mini">
          <span>Coach load</span>
          <strong>{simulated.coachLoad} members / coach</strong>
        </div>
        <div className="onb-stat-mini">
          <span>Utilization</span>
          <strong>{simulated.utilization}%</strong>
        </div>
      </div>

      <div className="onb-preview-chart">
        {simulated.bars.map((height, index) => (
          <div key={index} className="onb-preview-bar-col">
            <div className="onb-preview-bar" style={{ height: `${height}%` }} />
          </div>
        ))}
      </div>

      <div className="onb-preview-meta">
        <span>{simulated.members || 0} members target</span>
        <span>{simulated.coaches || 0} coaches target</span>
        <span>{data.subscriptionTypes.length || 0} plans selected</span>
      </div>
    </aside>
  );
}
