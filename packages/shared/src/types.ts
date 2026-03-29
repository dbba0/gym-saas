export type Role = "ADMIN" | "COACH" | "MEMBER";

export type PaymentMethod = "MOBILE_MONEY" | "CARD" | "CASH";

export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELED" | "PENDING";

export type AttendanceSource = "QR" | "MANUAL";

export type ApiError = {
  message: string;
  code?: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AuthUser = {
  id: string;
  role: Role;
  gymId: string | null;
  email: string;
  name: string;
};
