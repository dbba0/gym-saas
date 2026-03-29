"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import StepProgress from "./StepProgress";
import PasswordStrength from "./PasswordStrength";
import GymPreviewCard from "./GymPreviewCard";
import {
  AdminOnboardingData,
  DEFAULT_ONBOARDING_DATA,
  FieldErrors,
  OnboardingStep,
  SubscriptionType,
  SupportedCurrency
} from "./types";

const REGISTER_ENDPOINT = "/api/public/register-admin";
const SUBSCRIPTIONS_ENDPOINT = "/api/admin/subscriptions";

type Direction = "forward" | "backward";
type FieldStatus = "idle" | "valid" | "invalid";

const SUBSCRIPTION_OPTIONS: Array<{
  value: SubscriptionType;
  title: string;
  description: string;
  duration: string;
}> = [
  {
    value: "MONTHLY",
    title: "Monthly",
    description: "Flexible and ideal for first-time members",
    duration: "1 month"
  },
  {
    value: "QUARTERLY",
    title: "Quarterly",
    description: "Balanced retention and commitment",
    duration: "3 months"
  },
  {
    value: "YEARLY",
    title: "Yearly",
    description: "Best long-term loyalty and cashflow",
    duration: "12 months"
  }
];

const CURRENCY_OPTIONS: Array<{ value: SupportedCurrency; label: string; symbol: string }> = [
  { value: "XOF", label: "West CFA", symbol: "FCFA" },
  { value: "USD", label: "US Dollar", symbol: "$" },
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "CAD", label: "Canadian Dollar", symbol: "C$" }
];

const OPENING_PRESETS = [
  "Mon-Sat · 06:00 - 22:00",
  "7 days · 05:30 - 23:00",
  "Mon-Fri · 06:00 - 21:00",
  "7 days · 24h"
];

const CAPACITY_PRESETS = [
  {
    key: "starter",
    title: "Starter",
    members: 80,
    coaches: 4,
    description: "Perfect for a single location launch"
  },
  {
    key: "growth",
    title: "Growth",
    members: 180,
    coaches: 10,
    description: "Solid setup for a busy neighborhood gym"
  },
  {
    key: "scale",
    title: "Scale",
    members: 320,
    coaches: 18,
    description: "Ambitious setup for premium positioning"
  }
] as const;

const BASE_MONTHLY_PRICE: Record<SupportedCurrency, number> = {
  XOF: 20000,
  USD: 3900,
  EUR: 3500,
  CAD: 4900
};

const SUBSCRIPTION_BLUEPRINTS: Record<
  SubscriptionType,
  { name: string; durationMonths: number; multiplier: number }
> = {
  MONTHLY: { name: "Monthly", durationMonths: 1, multiplier: 1 },
  QUARTERLY: { name: "Quarterly", durationMonths: 3, multiplier: 2.7 },
  YEARLY: { name: "Yearly", durationMonths: 12, multiplier: 10 }
};

const STEP_FIELDS: Record<OnboardingStep, Array<keyof AdminOnboardingData>> = {
  0: ["firstName", "lastName", "email", "phone", "password", "confirmPassword"],
  1: ["gymName", "address", "city", "country", "gymPhone", "logoFile", "primaryColor"],
  2: ["estimatedMembers", "estimatedCoaches", "subscriptionTypes", "currency", "openingHours"],
  3: []
};

const REQUIRED_FIELDS = new Set<keyof AdminOnboardingData>([
  "firstName",
  "lastName",
  "email",
  "password",
  "confirmPassword",
  "gymName",
  "address",
  "city",
  "country",
  "gymPhone",
  "estimatedMembers",
  "estimatedCoaches",
  "subscriptionTypes",
  "currency",
  "openingHours"
]);

type SuccessState = {
  gymName: string;
  adminEmail: string;
  subscriptionsCreated: number;
  warnings: string[];
  setupPayload: {
    estimatedMembers: number;
    estimatedCoaches: number;
    subscriptionTypes: SubscriptionType[];
    currency: SupportedCurrency;
    openingHours: string;
    branding: {
      primaryColor: string;
      logoFileName: string | null;
    };
    adminContact: {
      phone: string | null;
    };
  };
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phoneDigitCount(value: string) {
  return value.replace(/\D/g, "").length;
}

function formatPhoneInput(value: string) {
  const keepPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, 15);
  const groups = digits.match(/.{1,3}/g) || [];
  return `${keepPlus ? "+" : ""}${groups.join(" ")}`.trim();
}

function fieldStep(field: keyof AdminOnboardingData): OnboardingStep {
  if (STEP_FIELDS[0].includes(field)) {
    return 0;
  }
  if (STEP_FIELDS[1].includes(field)) {
    return 1;
  }
  return 2;
}

function validateStep(step: OnboardingStep, data: AdminOnboardingData): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 0) {
    if (!data.firstName.trim()) errors.firstName = "First name is required.";
    if (!data.lastName.trim()) errors.lastName = "Last name is required.";
    if (!data.email.trim() || !isValidEmail(data.email.trim())) {
      errors.email = "A valid email is required.";
    }

    if (data.phone.trim() && phoneDigitCount(data.phone) < 8) {
      errors.phone = "Phone number looks too short.";
    }

    if (!data.password || data.password.length < 8) {
      errors.password = "Use at least 8 characters.";
    } else if (!/[A-Z]/.test(data.password) || !/[0-9]/.test(data.password)) {
      errors.password = "Add at least one uppercase letter and one number.";
    }

    if (!/[^A-Za-z0-9]/.test(data.password)) {
      errors.password = "Add at least one special character for stronger security.";
    }

    if (data.confirmPassword !== data.password) {
      errors.confirmPassword = "Passwords do not match.";
    }
  }

  if (step === 1) {
    if (!data.gymName.trim()) errors.gymName = "Gym name is required.";
    if (!data.address.trim()) errors.address = "Address is required.";
    if (!data.city.trim()) errors.city = "City is required.";
    if (!data.country.trim()) errors.country = "Country is required.";
    if (!data.gymPhone.trim() || phoneDigitCount(data.gymPhone) < 8) {
      errors.gymPhone = "A valid gym phone is required.";
    }

    if (data.primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(data.primaryColor)) {
      errors.primaryColor = "Use a valid HEX color (example: #ff6b35).";
    }
  }

  if (step === 2) {
    if (!data.estimatedMembers.trim() || Number(data.estimatedMembers) <= 0) {
      errors.estimatedMembers = "Estimated members must be greater than 0.";
    }

    if (!data.estimatedCoaches.trim() || Number(data.estimatedCoaches) <= 0) {
      errors.estimatedCoaches = "Estimated coaches must be greater than 0.";
    }

    if (
      Number(data.estimatedMembers || "0") > 0 &&
      Number(data.estimatedCoaches || "0") > Number(data.estimatedMembers || "0")
    ) {
      errors.estimatedCoaches = "Coaches cannot exceed members in this estimate.";
    }

    if (data.subscriptionTypes.length === 0) {
      errors.subscriptionTypes = "Pick at least one subscription type.";
    }

    if (!data.openingHours.trim()) {
      errors.openingHours = "Opening hours are required.";
    }
  }

  return errors;
}

function validateAll(data: AdminOnboardingData): FieldErrors {
  return {
    ...validateStep(0, data),
    ...validateStep(1, data),
    ...validateStep(2, data)
  };
}

function InputField(props: {
  id: keyof AdminOnboardingData;
  label: string;
  type?: string;
  value: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  status: FieldStatus;
  inputMode?: "text" | "email" | "tel" | "numeric";
  onBlur: () => void;
  onChange: (value: string) => void;
}) {
  const {
    id,
    label,
    type = "text",
    value,
    placeholder,
    error,
    required,
    status,
    inputMode = "text",
    onBlur,
    onChange
  } = props;

  return (
    <label className={`onb-field state-${status}`} htmlFor={id}>
      <span>
        {label}
        {required ? <em>*</em> : null}
      </span>
      <div className="onb-input-wrap">
        <input
          id={id}
          className={`input onb-input ${error ? "has-error" : ""}`}
          type={type}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          inputMode={inputMode}
        />
        <span className={`onb-field-indicator ${status}`} aria-hidden="true">
          {status === "valid" ? "✓" : status === "invalid" ? "!" : ""}
        </span>
      </div>
      {error ? <small className="error-text">{error}</small> : null}
    </label>
  );
}

async function provisionInitialSubscriptions(token: string, data: AdminOnboardingData) {
  let created = 0;
  const warnings: string[] = [];

  for (const subType of data.subscriptionTypes) {
    const blueprint = SUBSCRIPTION_BLUEPRINTS[subType];
    const monthlyPrice = BASE_MONTHLY_PRICE[data.currency];
    const priceCents = Math.round(monthlyPrice * blueprint.multiplier);

    const response = await fetch(SUBSCRIPTIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: `${blueprint.name} (${data.currency})`,
        durationMonths: blueprint.durationMonths,
        priceCents
      })
    });

    if (response.ok) {
      created += 1;
      continue;
    }

    const text = await response.text();
    let message = `Could not create ${blueprint.name} plan.`;

    try {
      const payload = text ? JSON.parse(text) : null;
      if (payload?.message) {
        message = `${blueprint.name}: ${payload.message}`;
      }
    } catch {
      if (text) {
        message = `${blueprint.name}: ${text}`;
      }
    }

    warnings.push(message);
  }

  return { created, warnings };
}

export default function AdminOnboardingWizard() {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [direction, setDirection] = useState<Direction>("forward");
  const [data, setData] = useState<AdminOnboardingData>(DEFAULT_ONBOARDING_DATA);
  const [touched, setTouched] = useState<Partial<Record<keyof AdminOnboardingData, boolean>>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const allErrors = useMemo(() => validateAll(data), [data]);
  const stepErrors = useMemo(() => validateStep(step, data), [step, data]);

  const updateField = <K extends keyof AdminOnboardingData>(field: K, value: AdminOnboardingData[K]) => {
    let nextValue = value;

    if ((field === "phone" || field === "gymPhone") && typeof value === "string") {
      nextValue = formatPhoneInput(value) as AdminOnboardingData[K];
    }

    if (field === "email" && typeof value === "string") {
      nextValue = value.trimStart().toLowerCase() as AdminOnboardingData[K];
    }

    if (field === "primaryColor" && typeof value === "string") {
      const withHash = value.startsWith("#") ? value : `#${value}`;
      nextValue = withHash.slice(0, 7) as AdminOnboardingData[K];
    }

    setData((prev) => ({ ...prev, [field]: nextValue }));
    setSubmitError(null);
  };

  const markTouched = (field: keyof AdminOnboardingData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const touchStepFields = (targetStep: OnboardingStep) => {
    setTouched((prev) => {
      const next = { ...prev };
      for (const field of STEP_FIELDS[targetStep]) {
        next[field] = true;
      }
      return next;
    });
  };

  const shouldDisplayError = (field: keyof AdminOnboardingData) => {
    if (!allErrors[field]) {
      return undefined;
    }
    if (showErrors || touched[field]) {
      return allErrors[field];
    }
    return undefined;
  };

  const getFieldStatus = (field: keyof AdminOnboardingData): FieldStatus => {
    const hasError = Boolean(allErrors[field]);
    if (hasError && (showErrors || touched[field])) {
      return "invalid";
    }

    if (!touched[field] && !showErrors) {
      return "idle";
    }

    const value = data[field];
    if (REQUIRED_FIELDS.has(field)) {
      if (Array.isArray(value)) {
        return value.length > 0 && !hasError ? "valid" : "idle";
      }
      if (typeof value === "string") {
        return value.trim().length > 0 && !hasError ? "valid" : "idle";
      }
      if (value) {
        return !hasError ? "valid" : "idle";
      }
      return "idle";
    }

    if (typeof value === "string" && value.trim().length === 0) {
      return "idle";
    }

    return hasError ? "invalid" : "valid";
  };

  const nextStep = () => {
    touchStepFields(step);
    setShowErrors(true);
    if (Object.keys(stepErrors).length > 0) {
      return;
    }

    setDirection("forward");
    setStep((prev) => Math.min(prev + 1, 3) as OnboardingStep);
    setShowErrors(false);
  };

  const previousStep = () => {
    setDirection("backward");
    setStep((prev) => Math.max(prev - 1, 0) as OnboardingStep);
    setShowErrors(false);
    setSubmitError(null);
  };

  const toggleSubscription = (value: SubscriptionType) => {
    setTouched((prev) => ({ ...prev, subscriptionTypes: true }));
    setData((prev) => {
      const exists = prev.subscriptionTypes.includes(value);
      const next = exists
        ? prev.subscriptionTypes.filter((item) => item !== value)
        : [...prev.subscriptionTypes, value];
      return { ...prev, subscriptionTypes: next };
    });
  };

  const pickCapacity = (members: number, coaches: number) => {
    setTouched((prev) => ({ ...prev, estimatedMembers: true, estimatedCoaches: true }));
    setData((prev) => ({
      ...prev,
      estimatedMembers: String(members),
      estimatedCoaches: String(coaches)
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const collectedErrors = validateAll(data);

    if (Object.keys(collectedErrors).length > 0) {
      setTouched((prev) => {
        const next = { ...prev };
        (Object.keys(collectedErrors) as Array<keyof AdminOnboardingData>).forEach((field) => {
          next[field] = true;
        });
        return next;
      });

      const firstField = Object.keys(collectedErrors)[0] as keyof AdminOnboardingData;
      const targetStep = fieldStep(firstField);
      setDirection(targetStep >= step ? "forward" : "backward");
      setStep(targetStep);
      setShowErrors(true);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const registerPayload = {
        gymName: data.gymName.trim(),
        gymAddress: [data.address.trim(), data.city.trim(), data.country.trim()].filter(Boolean).join(", "),
        gymPhone: data.gymPhone.trim(),
        adminName: `${data.firstName.trim()} ${data.lastName.trim()}`.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password
      };

      const registerResponse = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerPayload)
      });

      const registerText = await registerResponse.text();
      let registerData: any = null;

      try {
        registerData = registerText ? JSON.parse(registerText) : null;
      } catch {
        registerData = null;
      }

      if (!registerResponse.ok) {
        throw new Error(registerData?.message || "Unable to create your admin workspace.");
      }

      const token = registerData?.token as string | undefined;
      if (!token) {
        throw new Error("Registration succeeded but session token is missing.");
      }

      const setupPayload = {
        estimatedMembers: Number(data.estimatedMembers),
        estimatedCoaches: Number(data.estimatedCoaches),
        subscriptionTypes: data.subscriptionTypes,
        currency: data.currency,
        openingHours: data.openingHours.trim(),
        branding: {
          primaryColor: data.primaryColor,
          logoFileName: data.logoFile?.name || null
        },
        adminContact: {
          phone: data.phone.trim() || null
        }
      };

      const provisioning = await provisionInitialSubscriptions(token, data);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("GYM_SETUP_PAYLOAD", JSON.stringify(setupPayload));
      }

      setSuccess({
        gymName: data.gymName,
        adminEmail: data.email,
        subscriptionsCreated: provisioning.created,
        warnings: provisioning.warnings,
        setupPayload
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong while creating the workspace.";
      const looksLikeNetworkIssue =
        error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message);

      setSubmitError(
        looksLikeNetworkIssue
          ? "Cannot reach backend API. Ensure `npm run dev:api` is running and NEXT_PUBLIC_API_URL points to your API host."
          : message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goToAdminLogin = () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.removeItem("GYM_ADMIN_TOKEN");
    } catch {
      // Ignore storage restrictions and continue navigation.
    }
    window.location.assign("/login");
  };

  if (success) {
    return (
      <main className="onb-page">
        <div className="onb-shell single">
          <section className="onb-panel success onb-success-panel">
            <div className="onb-success-icon">✓</div>
            <p className="onb-kicker">Workspace ready</p>
            <h1>{success.gymName} is live</h1>
            <p className="subtitle">
              Your admin account <strong>{success.adminEmail}</strong> is created. You can now start managing members,
              coaches, classes, subscriptions and payments.
            </p>

            <div className="onb-success-grid">
              <div className="card onb-review-card">
                <p className="subtitle">Subscriptions created</p>
                <h3 style={{ fontFamily: "var(--font-head)", fontSize: 34 }}>{success.subscriptionsCreated}</h3>
              </div>
              <div className="card onb-review-card">
                <p className="subtitle">Opening hours</p>
                <h3 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>{success.setupPayload.openingHours}</h3>
              </div>
            </div>

            {success.warnings.length > 0 ? (
              <div className="card onb-warning-card">
                <p className="onb-warning-title">Heads up</p>
                <ul className="onb-warning-list">
                  {success.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="onb-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn onb-cta-primary" onClick={goToAdminLogin}>
                Go to admin login
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setData(DEFAULT_ONBOARDING_DATA);
                  setTouched({});
                  setShowErrors(false);
                  setSubmitError(null);
                  setSuccess(null);
                  setDirection("forward");
                  setStep(0);
                }}
              >
                Create another gym
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="onb-page">
      <div className="onb-shell">
        <section className="onb-panel">
          <p className="onb-kicker">Premium onboarding</p>
          <h1>Create your gym SaaS workspace</h1>
          <p className="subtitle">Four guided steps to launch your operation in minutes.</p>

          <StepProgress currentStep={step} />

          <form onSubmit={submit}>
            <div key={step} className={`onb-step-panel ${direction}`}>
              {step === 0 ? (
                <div className="onb-form-grid two">
                  <InputField
                    id="firstName"
                    label="First name"
                    value={data.firstName}
                    placeholder="Aminata"
                    required
                    onBlur={() => markTouched("firstName")}
                    onChange={(value) => updateField("firstName", value)}
                    error={shouldDisplayError("firstName")}
                    status={getFieldStatus("firstName")}
                  />
                  <InputField
                    id="lastName"
                    label="Last name"
                    value={data.lastName}
                    placeholder="Ndiaye"
                    required
                    onBlur={() => markTouched("lastName")}
                    onChange={(value) => updateField("lastName", value)}
                    error={shouldDisplayError("lastName")}
                    status={getFieldStatus("lastName")}
                  />
                  <InputField
                    id="email"
                    label="Work email"
                    type="email"
                    inputMode="email"
                    value={data.email}
                    placeholder="owner@gym.com"
                    required
                    onBlur={() => markTouched("email")}
                    onChange={(value) => updateField("email", value)}
                    error={shouldDisplayError("email")}
                    status={getFieldStatus("email")}
                  />
                  <InputField
                    id="phone"
                    label="Phone (optional)"
                    inputMode="tel"
                    value={data.phone}
                    placeholder="+221 77 000 00 00"
                    onBlur={() => markTouched("phone")}
                    onChange={(value) => updateField("phone", value)}
                    error={shouldDisplayError("phone")}
                    status={getFieldStatus("phone")}
                  />
                  <InputField
                    id="password"
                    label="Password"
                    type="password"
                    value={data.password}
                    placeholder="••••••••"
                    required
                    onBlur={() => markTouched("password")}
                    onChange={(value) => updateField("password", value)}
                    error={shouldDisplayError("password")}
                    status={getFieldStatus("password")}
                  />
                  <InputField
                    id="confirmPassword"
                    label="Confirm password"
                    type="password"
                    value={data.confirmPassword}
                    placeholder="••••••••"
                    required
                    onBlur={() => markTouched("confirmPassword")}
                    onChange={(value) => updateField("confirmPassword", value)}
                    error={shouldDisplayError("confirmPassword")}
                    status={getFieldStatus("confirmPassword")}
                  />
                  <div className="onb-span-2">
                    <PasswordStrength password={data.password} />
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="onb-form-grid two">
                  <InputField
                    id="gymName"
                    label="Gym name"
                    value={data.gymName}
                    placeholder="Atlas Gym Dakar"
                    required
                    onBlur={() => markTouched("gymName")}
                    onChange={(value) => updateField("gymName", value)}
                    error={shouldDisplayError("gymName")}
                    status={getFieldStatus("gymName")}
                  />
                  <InputField
                    id="gymPhone"
                    label="Gym phone"
                    inputMode="tel"
                    value={data.gymPhone}
                    placeholder="+221 33 000 00 00"
                    required
                    onBlur={() => markTouched("gymPhone")}
                    onChange={(value) => updateField("gymPhone", value)}
                    error={shouldDisplayError("gymPhone")}
                    status={getFieldStatus("gymPhone")}
                  />
                  <div className="onb-span-2">
                    <InputField
                      id="address"
                      label="Address"
                      value={data.address}
                      placeholder="Avenue Cheikh Anta Diop"
                      required
                      onBlur={() => markTouched("address")}
                      onChange={(value) => updateField("address", value)}
                      error={shouldDisplayError("address")}
                      status={getFieldStatus("address")}
                    />
                  </div>
                  <InputField
                    id="city"
                    label="City"
                    value={data.city}
                    placeholder="Dakar"
                    required
                    onBlur={() => markTouched("city")}
                    onChange={(value) => updateField("city", value)}
                    error={shouldDisplayError("city")}
                    status={getFieldStatus("city")}
                  />
                  <InputField
                    id="country"
                    label="Country"
                    value={data.country}
                    placeholder="Senegal"
                    required
                    onBlur={() => markTouched("country")}
                    onChange={(value) => updateField("country", value)}
                    error={shouldDisplayError("country")}
                    status={getFieldStatus("country")}
                  />

                  <label className="onb-field state-idle">
                    <span>Logo (optional)</span>
                    <input
                      className="input onb-input"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        markTouched("logoFile");
                        updateField("logoFile", event.target.files?.[0] || null);
                      }}
                    />
                  </label>

                  <label className={`onb-field state-${getFieldStatus("primaryColor")}`} htmlFor="primaryColor">
                    <span>Primary color (optional)</span>
                    <div className="onb-color-row">
                      <input
                        id="primaryColor"
                        type="color"
                        value={data.primaryColor}
                        onChange={(event) => {
                          markTouched("primaryColor");
                          updateField("primaryColor", event.target.value);
                        }}
                        className="onb-color"
                        aria-label="Choose primary color"
                      />
                      <div className="onb-input-wrap">
                        <input
                          className={`input onb-input ${shouldDisplayError("primaryColor") ? "has-error" : ""}`}
                          value={data.primaryColor}
                          onBlur={() => markTouched("primaryColor")}
                          onChange={(event) => updateField("primaryColor", event.target.value)}
                        />
                        <span className={`onb-field-indicator ${getFieldStatus("primaryColor")}`}>
                          {getFieldStatus("primaryColor") === "valid"
                            ? "✓"
                            : getFieldStatus("primaryColor") === "invalid"
                              ? "!"
                              : ""}
                        </span>
                      </div>
                    </div>
                    {shouldDisplayError("primaryColor") ? (
                      <small className="error-text">{shouldDisplayError("primaryColor")}</small>
                    ) : null}
                  </label>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="onb-form-grid">
                  <div className="onb-choice-group">
                    <div>
                      <p className="onb-choice-title">Business size presets</p>
                      <p className="subtitle">One click to prefill your growth assumptions.</p>
                    </div>
                    <div className="onb-choice-grid three">
                      {CAPACITY_PRESETS.map((preset) => {
                        const active =
                          Number(data.estimatedMembers) === preset.members &&
                          Number(data.estimatedCoaches) === preset.coaches;
                        return (
                          <button
                            key={preset.key}
                            type="button"
                            className={`onb-choice-card ${active ? "active" : ""}`}
                            onClick={() => pickCapacity(preset.members, preset.coaches)}
                          >
                            <strong>{preset.title}</strong>
                            <span>{preset.description}</span>
                            <small>
                              {preset.members} members · {preset.coaches} coaches
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="onb-form-grid two">
                    <InputField
                      id="estimatedMembers"
                      label="Estimated members"
                      type="number"
                      inputMode="numeric"
                      value={data.estimatedMembers}
                      required
                      onBlur={() => markTouched("estimatedMembers")}
                      onChange={(value) => updateField("estimatedMembers", value)}
                      error={shouldDisplayError("estimatedMembers")}
                      status={getFieldStatus("estimatedMembers")}
                    />
                    <InputField
                      id="estimatedCoaches"
                      label="Estimated coaches"
                      type="number"
                      inputMode="numeric"
                      value={data.estimatedCoaches}
                      required
                      onBlur={() => markTouched("estimatedCoaches")}
                      onChange={(value) => updateField("estimatedCoaches", value)}
                      error={shouldDisplayError("estimatedCoaches")}
                      status={getFieldStatus("estimatedCoaches")}
                    />
                  </div>

                  <div className="onb-choice-group">
                    <div>
                      <p className="onb-choice-title">Subscription types</p>
                      <p className="subtitle">Select plans to preconfigure in your workspace.</p>
                    </div>
                    <div className="onb-choice-grid three">
                      {SUBSCRIPTION_OPTIONS.map((option) => {
                        const active = data.subscriptionTypes.includes(option.value);
                        const estimatePrice = Math.round(
                          BASE_MONTHLY_PRICE[data.currency] * SUBSCRIPTION_BLUEPRINTS[option.value].multiplier
                        );
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleSubscription(option.value)}
                            className={`onb-choice-card ${active ? "active" : ""}`}
                          >
                            <strong>{option.title}</strong>
                            <span>{option.description}</span>
                            <small>
                              {option.duration} · {(estimatePrice / 100).toLocaleString()} {data.currency}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                    {shouldDisplayError("subscriptionTypes") ? (
                      <small className="error-text">{shouldDisplayError("subscriptionTypes")}</small>
                    ) : null}
                  </div>

                  <div className="onb-choice-group">
                    <p className="onb-choice-title">Currency</p>
                    <div className="onb-choice-grid four">
                      {CURRENCY_OPTIONS.map((currency) => {
                        const active = data.currency === currency.value;
                        return (
                          <button
                            type="button"
                            key={currency.value}
                            className={`onb-choice-card compact ${active ? "active" : ""}`}
                            onClick={() => {
                              markTouched("currency");
                              updateField("currency", currency.value);
                            }}
                          >
                            <strong>{currency.value}</strong>
                            <span>{currency.symbol}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className={`onb-field state-${getFieldStatus("openingHours")}`} htmlFor="openingHours">
                    <span>
                      Opening hours
                      <em>*</em>
                    </span>
                    <div className="onb-input-wrap">
                      <input
                        id="openingHours"
                        className={`input onb-input ${shouldDisplayError("openingHours") ? "has-error" : ""}`}
                        value={data.openingHours}
                        onBlur={() => markTouched("openingHours")}
                        onChange={(event) => updateField("openingHours", event.target.value)}
                        placeholder="Mon-Sat · 06:00 - 22:00"
                      />
                      <span className={`onb-field-indicator ${getFieldStatus("openingHours")}`}>
                        {getFieldStatus("openingHours") === "valid"
                          ? "✓"
                          : getFieldStatus("openingHours") === "invalid"
                            ? "!"
                            : ""}
                      </span>
                    </div>
                    {shouldDisplayError("openingHours") ? (
                      <small className="error-text">{shouldDisplayError("openingHours")}</small>
                    ) : null}
                    <div className="onb-chip-row">
                      {OPENING_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`onb-chip ${data.openingHours === preset ? "active" : ""}`}
                          onClick={() => {
                            markTouched("openingHours");
                            updateField("openingHours", preset);
                          }}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="onb-review-grid">
                  <article className="card onb-review-card">
                    <p className="onb-review-title">Admin profile</p>
                    <h3>
                      {data.firstName} {data.lastName}
                    </h3>
                    <p>{data.email}</p>
                    <p>{data.phone || "No phone provided"}</p>
                  </article>

                  <article className="card onb-review-card">
                    <p className="onb-review-title">Gym identity</p>
                    <h3>{data.gymName}</h3>
                    <p>{data.address}</p>
                    <p>
                      {data.city}, {data.country}
                    </p>
                    <p>{data.gymPhone}</p>
                  </article>

                  <article className="card onb-review-card highlight">
                    <p className="onb-review-title">Launch setup</p>
                    <h3>
                      {data.estimatedMembers} members · {data.estimatedCoaches} coaches
                    </h3>
                    <p>{data.subscriptionTypes.join(" · ")}</p>
                    <p>{data.currency}</p>
                    <p>{data.openingHours}</p>
                  </article>

                  <article className="card onb-review-card note">
                    <p className="onb-review-title">What happens next</p>
                    <p>
                      We will instantly create your admin account and gym workspace, then provision your selected
                      subscription plans so your team can onboard members immediately.
                    </p>
                  </article>
                </div>
              ) : null}
            </div>

            {submitError ? <p className="error-text onb-submit-error">{submitError}</p> : null}

            <div className="onb-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={previousStep}
                disabled={step === 0 || submitting}
              >
                Back
              </button>

              {step < 3 ? (
                <button type="button" className="btn onb-cta-primary" onClick={nextStep}>
                  Continue
                </button>
              ) : (
                <button type="submit" className="btn onb-cta-primary onb-submit-cta" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="onb-spinner" aria-hidden="true" />
                      Creating your space...
                    </>
                  ) : (
                    "Créer mon espace"
                  )}
                </button>
              )}
            </div>
          </form>

          <p className="onb-footer-text">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </section>

        <GymPreviewCard data={data} currentStep={step} />
      </div>
    </main>
  );
}
