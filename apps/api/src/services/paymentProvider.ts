import type { Request } from "express";
import crypto from "crypto";
import { env } from "../config/env";

export type SenegalMobileMoneyMethod = "WAVE" | "ORANGE_MONEY" | "FREE_MONEY";
export type PaymentState = "PENDING" | "PAID" | "FAILED" | "CANCELED";

type CreatePaymentIntentInput = {
  amountCents: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  gymName: string;
  providerReference: string;
  preferredMethod: SenegalMobileMoneyMethod;
  gymId: string;
  memberId: string;
  subscriptionId?: string;
};

export type PaymentIntentResult = {
  provider: "PAYDUNYA";
  providerReference: string;
  providerPaymentId: string | null;
  checkoutUrl: string;
  status: PaymentState;
  rawPayload: unknown;
};

export type PaymentConfirmationResult = {
  provider: "PAYDUNYA";
  providerReference: string;
  providerPaymentId: string | null;
  status: PaymentState;
  failureReason?: string;
  rawPayload: unknown;
};

export type ProviderWebhookEvent = {
  provider: "PAYDUNYA";
  eventKey: string;
  providerReference: string;
  providerPaymentId: string | null;
  status: PaymentState;
  failureReason?: string;
  rawPayload: unknown;
};

export interface PaymentProvider {
  readonly provider: "PAYDUNYA";
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  confirmPayment(providerReference: string): Promise<PaymentConfirmationResult>;
  parseWebhookEvent(req: Request): ProviderWebhookEvent | null;
}

const CHANNEL_MAP: Record<SenegalMobileMoneyMethod, string> = {
  WAVE: "wave-senegal",
  ORANGE_MONEY: "orange-money-senegal",
  FREE_MONEY: "free-money-senegal"
};

function normalizeState(value: unknown): PaymentState {
  const source = String(value || "")
    .trim()
    .toLowerCase();
  if (!source) {
    return "PENDING";
  }
  if (
    source.includes("paid") ||
    source.includes("success") ||
    source.includes("complete") ||
    source.includes("approved")
  ) {
    return "PAID";
  }
  if (source.includes("cancel")) {
    return "CANCELED";
  }
  if (
    source.includes("fail") ||
    source.includes("declined") ||
    source.includes("reject") ||
    source.includes("error") ||
    source.includes("expired")
  ) {
    return "FAILED";
  }
  return "PENDING";
}

function ensureObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function cleanSignature(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("=")) {
    const [, digest] = trimmed.split("=");
    return (digest || "").trim();
  }
  return trimmed;
}

function secureCompare(input: string | null, expected: string | null) {
  if (!input || !expected) {
    return false;
  }
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

class PayDunyaProvider implements PaymentProvider {
  readonly provider = "PAYDUNYA" as const;

  private readonly createUrl: string;
  private readonly confirmBaseUrl: string;
  private readonly callbackUrl: string;
  private readonly returnUrl: string;
  private readonly cancelUrl: string;
  private readonly webhookSecret: string | null;
  private readonly webhookToleranceSeconds: number;

  constructor() {
    const sandbox = env.PAYDUNYA_MODE !== "live";
    const defaultCreateUrl = sandbox
      ? "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create"
      : "https://app.paydunya.com/api/v1/checkout-invoice/create";
    const defaultConfirmBaseUrl = sandbox
      ? "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/confirm"
      : "https://app.paydunya.com/api/v1/checkout-invoice/confirm";

    this.createUrl = env.PAYDUNYA_CREATE_URL || defaultCreateUrl;
    this.confirmBaseUrl = env.PAYDUNYA_CONFIRM_BASE_URL || defaultConfirmBaseUrl;
    this.callbackUrl =
      env.PAYDUNYA_CALLBACK_URL ||
      `${env.API_PUBLIC_BASE_URL.replace(/\/$/, "")}/api/payments/webhooks/paydunya`;
    this.returnUrl = env.PAYDUNYA_RETURN_URL || "https://example.com/payment-success";
    this.cancelUrl = env.PAYDUNYA_CANCEL_URL || "https://example.com/payment-canceled";
    this.webhookSecret = env.PAYDUNYA_WEBHOOK_SECRET || null;
    this.webhookToleranceSeconds = env.PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS;
  }

  private hasKeys() {
    return Boolean(env.PAYDUNYA_MASTER_KEY && env.PAYDUNYA_PRIVATE_KEY && env.PAYDUNYA_TOKEN);
  }

  private getHeaders() {
    if (!this.hasKeys()) {
      return null;
    }
    return {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": env.PAYDUNYA_MASTER_KEY as string,
      "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY as string,
      "PAYDUNYA-TOKEN": env.PAYDUNYA_TOKEN as string
    };
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const preferredChannel = CHANNEL_MAP[input.preferredMethod];

    if (!this.hasKeys()) {
      return {
        provider: this.provider,
        providerReference: input.providerReference,
        providerPaymentId: `mock_${input.providerReference}`,
        checkoutUrl: `${this.returnUrl}?mock=true&ref=${encodeURIComponent(input.providerReference)}&channel=${preferredChannel}`,
        status: "PENDING",
        rawPayload: {
          mock: true,
          reason: "PayDunya keys are not configured.",
          preferredChannel
        }
      };
    }

    const amount = Number((input.amountCents / 100).toFixed(2));
    const payload = {
      invoice: {
        total_amount: amount,
        description: input.description
      },
      store: {
        name: input.gymName
      },
      actions: {
        callback_url: this.callbackUrl,
        return_url: this.returnUrl,
        cancel_url: this.cancelUrl
      },
      custom_data: {
        provider_reference: input.providerReference,
        gym_id: input.gymId,
        member_id: input.memberId,
        subscription_id: input.subscriptionId || null,
        preferred_channel: preferredChannel,
        currency: input.currency
      },
      customer: {
        name: input.customerName,
        email: input.customerEmail || undefined,
        phone: input.customerPhone || undefined
      }
    };

    const response = await fetch(this.createUrl, {
      method: "POST",
      headers: this.getHeaders() as HeadersInit,
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    let data: Record<string, any> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { rawText };
    }

    if (!response.ok) {
      const failureReason = data?.response_text || data?.message || "Provider returned an error";
      throw new Error(`PayDunya create intent failed: ${failureReason}`);
    }

    const checkoutUrl =
      data?.response_text?.startsWith?.("http") ? data.response_text : data?.invoice_url || data?.url;
    const providerReference =
      data?.token ||
      data?.invoice_token ||
      data?.invoice?.token ||
      input.providerReference;

    if (!checkoutUrl) {
      throw new Error("PayDunya intent created without checkout URL.");
    }

    return {
      provider: this.provider,
      providerReference,
      providerPaymentId: data?.invoice?.id || data?.invoice_id || null,
      checkoutUrl,
      status: "PENDING",
      rawPayload: data
    };
  }

  async confirmPayment(providerReference: string): Promise<PaymentConfirmationResult> {
    if (!this.hasKeys()) {
      return {
        provider: this.provider,
        providerReference,
        providerPaymentId: `mock_${providerReference}`,
        status: "PENDING",
        rawPayload: { mock: true, reason: "PayDunya keys are not configured." }
      };
    }

    const confirmUrl = `${this.confirmBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(providerReference)}`;
    const response = await fetch(confirmUrl, {
      method: "GET",
      headers: this.getHeaders() as HeadersInit
    });

    const rawText = await response.text();
    let data: Record<string, any> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { rawText };
    }

    if (!response.ok) {
      return {
        provider: this.provider,
        providerReference,
        providerPaymentId: null,
        status: "FAILED",
        failureReason: data?.response_text || data?.message || "Unable to confirm payment",
        rawPayload: data
      };
    }

    const status = normalizeState(data?.invoice?.status || data?.status || data?.response_code);
    return {
      provider: this.provider,
      providerReference,
      providerPaymentId: data?.invoice?.id || data?.invoice?.token || null,
      status,
      failureReason: status === "FAILED" ? data?.response_text || data?.message : undefined,
      rawPayload: data
    };
  }

  parseWebhookEvent(req: Request): ProviderWebhookEvent | null {
    const rawBody =
      (req as Request & { rawBody?: string }).rawBody ||
      JSON.stringify(req.body && typeof req.body === "object" ? req.body : {});

    if (this.webhookSecret) {
      const directSecret = req.header("x-paydunya-secret") || req.header("x-webhook-secret");
      const signatureHeader = req.header("x-paydunya-signature");
      const timestampHeader = req.header("x-paydunya-timestamp");

      let authorized = false;
      if (directSecret) {
        authorized = secureCompare(directSecret.trim(), this.webhookSecret);
      }

      if (!authorized && signatureHeader) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const providedTimestamp = Number(timestampHeader || "0");
        if (
          timestampHeader &&
          (!Number.isFinite(providedTimestamp) ||
            Math.abs(nowSeconds - providedTimestamp) > this.webhookToleranceSeconds)
        ) {
          return null;
        }

        const signedPayload = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;
        const expectedSignature = crypto
          .createHmac("sha256", this.webhookSecret)
          .update(signedPayload)
          .digest("hex");
        authorized = secureCompare(cleanSignature(signatureHeader), expectedSignature);
      }

      if (!authorized) {
        return null;
      }
    }

    const payload = ensureObject(req.body);
    if (Object.keys(payload).length === 0) {
      return null;
    }
    const invoice = ensureObject(payload.invoice);
    const customData = ensureObject(payload.custom_data);
    const providerReference =
      payload.provider_reference ||
      customData.provider_reference ||
      payload.token ||
      payload.invoice_token ||
      invoice.token;

    if (!providerReference) {
      return null;
    }

    const status = normalizeState(payload.status || invoice.status || payload.response_code);
    const failureReason =
      status === "FAILED" ? payload.response_text || payload.message || invoice.error_message : undefined;

    const eventIdCandidate =
      payload.event_id || payload.id || payload.notification_id || payload.transaction_id || invoice.id;
    const providerPaymentId = String(invoice.id || payload.transaction_id || "") || null;
    const eventKey = eventIdCandidate
      ? String(eventIdCandidate)
      : `${String(providerReference)}:${status}:${providerPaymentId || "none"}`;

    return {
      provider: this.provider,
      eventKey,
      providerReference: String(providerReference),
      providerPaymentId,
      status,
      failureReason,
      rawPayload: payload
    };
  }
}

let singletonProvider: PaymentProvider | null = null;

export function getPaymentProvider() {
  if (!singletonProvider) {
    singletonProvider = new PayDunyaProvider();
  }
  return singletonProvider;
}
