import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "GYM_AUTH_TOKEN";
const REFRESH_TOKEN_KEY = "GYM_AUTH_REFRESH_TOKEN";
const ROLE_KEY = "GYM_AUTH_ROLE";

export type MobileRole = "MEMBER" | "COACH" | "ADMIN";

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  role: MobileRole;
};

export async function saveSession(session: StoredSession) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
    SecureStore.setItemAsync(ROLE_KEY, session.role)
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, role] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(ROLE_KEY)
  ]);

  if (!accessToken || !refreshToken || !role) {
    return null;
  }

  if (role !== "MEMBER" && role !== "COACH" && role !== "ADMIN") {
    return null;
  }

  return { accessToken, refreshToken, role };
}

export async function clearSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(ROLE_KEY)
  ]);
}
