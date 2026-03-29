type PasswordStrengthProps = {
  password: string;
};

function getPasswordScore(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

function getLabel(score: number) {
  if (score <= 1) return "Weak";
  if (score === 2) return "Fair";
  if (score === 3) return "Strong";
  return "Excellent";
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const score = getPasswordScore(password);
  const label = password ? getLabel(score) : "Not set";
  const tone = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="onb-strength" aria-live="polite">
      <div className="onb-strength-bars">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className={`onb-strength-bar ${index < score ? "active" : ""}`} />
        ))}
      </div>
      <span className={`onb-strength-label tone-${tone}`}>Password strength: {label}</span>
    </div>
  );
}
