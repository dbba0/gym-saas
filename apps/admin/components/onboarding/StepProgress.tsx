import { ONBOARDING_STEPS, OnboardingStep } from "./types";

type StepProgressProps = {
  currentStep: OnboardingStep;
};

export default function StepProgress({ currentStep }: StepProgressProps) {
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <div className="onb-progress-wrap" aria-label="Onboarding progress">
      <div className="onb-progress-topline">
        <strong>{ONBOARDING_STEPS[currentStep]}</strong>
        <span>
          Step {currentStep + 1} / {ONBOARDING_STEPS.length}
        </span>
      </div>
      <div
        className="onb-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div className="onb-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="onb-step-line">
        {ONBOARDING_STEPS.map((label, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <div key={label} className="onb-step-item">
              <div className={`onb-step-dot ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}>
                {isDone ? "✓" : index + 1}
              </div>
              <span className={`onb-step-label ${isCurrent ? "current" : ""}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
