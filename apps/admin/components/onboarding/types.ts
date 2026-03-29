export type SubscriptionType = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type SupportedCurrency = "XOF" | "USD" | "EUR" | "CAD";

export type AdminOnboardingData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gymName: string;
  address: string;
  city: string;
  country: string;
  gymPhone: string;
  logoFile: File | null;
  primaryColor: string;
  estimatedMembers: string;
  estimatedCoaches: string;
  subscriptionTypes: SubscriptionType[];
  currency: SupportedCurrency;
  openingHours: string;
};

export type FieldErrors = Partial<Record<keyof AdminOnboardingData | "submit", string>>;

export const ONBOARDING_STEPS = ["Admin", "Gym", "Setup", "Review"] as const;

export type OnboardingStep = 0 | 1 | 2 | 3;

export const DEFAULT_ONBOARDING_DATA: AdminOnboardingData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  gymName: "",
  address: "",
  city: "",
  country: "",
  gymPhone: "",
  logoFile: null,
  primaryColor: "#ff6b35",
  estimatedMembers: "120",
  estimatedCoaches: "8",
  subscriptionTypes: ["MONTHLY"],
  currency: "XOF",
  openingHours: "Mon-Sat · 06:00 - 22:00"
};
