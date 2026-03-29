import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "GYM_AUTH_TOKEN";
const ROLE_KEY = "GYM_AUTH_ROLE";

export type MobileRole = "MEMBER" | "COACH" | "ADMIN";

export type StoredSession = {
  token: string;
  role: MobileRole;
};

export async function saveSession(session: StoredSession) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(ROLE_KEY, session.role)
  ]);
}

export async function loadSession(): Promise<StoredSession | null> {
  const [token, role] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(ROLE_KEY)
  ]);

  if (!token || !role) {
    return null;
  }

  if (role !== "MEMBER" && role !== "COACH" && role !== "ADMIN") {
    return null;
  }

  return { token, role };
}

export async function clearSession() {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(ROLE_KEY)]);
}
