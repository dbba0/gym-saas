import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold
} from "@expo-google-fonts/space-grotesk";

import LoginScreen from "./src/screens/LoginScreen";
import MemberHomeScreen from "./src/screens/MemberHomeScreen";
import MemberProgramScreen from "./src/screens/MemberProgramScreen";
import MemberProgressScreen from "./src/screens/MemberProgressScreen";
import MemberQrScreen from "./src/screens/MemberQrScreen";
import MemberBookingsScreen from "./src/screens/MemberBookingsScreen";
import CoachHomeScreen from "./src/screens/CoachHomeScreen";
import CoachProgramsScreen from "./src/screens/CoachProgramsScreen";
import CoachMembersScreen from "./src/screens/CoachMembersScreen";
import {
  apiPost,
  getApiBaseUrl,
  setAuthFailureHandler,
  setSessionRefreshHandler,
  setToken
} from "./src/lib/api";
import { clearSession, loadSession, saveSession } from "./src/lib/secureSession";
import { decodeJwt, isTokenExpired } from "./src/lib/jwt";

const Tab = createBottomTabNavigator();

type Role = "MEMBER" | "COACH" | "ADMIN";

type AuthState = {
  accessToken: string;
  refreshToken: string;
  role: Role;
};

type AuthPayload = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    role?: Role;
  };
};

function MemberTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home">{() => <MemberHomeScreen onLogout={onLogout} />}</Tab.Screen>
      <Tab.Screen name="Program" component={MemberProgramScreen} />
      <Tab.Screen name="Progress" component={MemberProgressScreen} />
      <Tab.Screen name="QR" component={MemberQrScreen} />
      <Tab.Screen name="Bookings" component={MemberBookingsScreen} />
    </Tab.Navigator>
  );
}

function CoachTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home">{() => <CoachHomeScreen onLogout={onLogout} />}</Tab.Screen>
      <Tab.Screen name="Programs" component={CoachProgramsScreen} />
      <Tab.Screen name="Members" component={CoachMembersScreen} />
    </Tab.Navigator>
  );
}

function AdminMobileNotice({ onLogout }: { onLogout: () => void }) {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Admin accounts use the web dashboard.</Text>
      <TouchableOpacity style={styles.cta} onPress={onLogout}>
        <Text style={styles.ctaText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

function normalizeAuthPayload(payload: AuthPayload | null): AuthState | null {
  if (!payload) {
    return null;
  }
  const accessToken = payload.accessToken || payload.token;
  const refreshToken = payload.refreshToken;
  const role = payload.user?.role;
  if (!accessToken || !refreshToken || !role) {
    return null;
  }
  const decoded = decodeJwt(accessToken);
  if (decoded?.role && decoded.role !== role) {
    return null;
  }
  return { accessToken, refreshToken, role };
}

async function refreshWithToken(refreshToken: string): Promise<AuthState | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as AuthPayload;
    return normalizeAuthPayload(payload);
  } catch {
    return null;
  }
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold
  });

  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const refreshTokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const applyAuth = useCallback(async (next: AuthState | null) => {
    if (!next) {
      refreshTokenRef.current = null;
      setToken(null);
      setAuth(null);
      await clearSession().catch(() => null);
      return;
    }

    refreshTokenRef.current = next.refreshToken;
    setToken(next.accessToken);
    setAuth(next);
    await saveSession({
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      role: next.role
    });
  }, []);

  const handleSessionRefresh = useCallback(async () => {
    const currentRefreshToken = refreshTokenRef.current;
    if (!currentRefreshToken) {
      return false;
    }

    const refreshed = await refreshWithToken(currentRefreshToken);
    if (!refreshed) {
      await applyAuth(null);
      return false;
    }

    if (!mountedRef.current) {
      return false;
    }

    await applyAuth(refreshed);
    return true;
  }, [applyAuth]);

  useEffect(() => {
    mountedRef.current = true;

    setAuthFailureHandler((reason) => {
      applyAuth(null).catch(() => null);
      if (!mountedRef.current) {
        return;
      }
      setAuth(null);
      Alert.alert(reason === "expired" ? "Session expired" : "Session invalid", "Please sign in again.");
    });
    setSessionRefreshHandler(handleSessionRefresh);

    loadSession()
      .then(async (session) => {
        if (!mountedRef.current) {
          return;
        }
        if (!session) {
          await applyAuth(null);
          return;
        }
        if (!isTokenExpired(session.accessToken)) {
          await applyAuth({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            role: session.role
          });
          return;
        }

        const refreshed = await refreshWithToken(session.refreshToken);
        if (!refreshed) {
          await applyAuth(null);
          return;
        }
        await applyAuth(refreshed);
      })
      .finally(() => {
        if (mountedRef.current) {
          setHydrating(false);
        }
      });

    return () => {
      mountedRef.current = false;
      setAuthFailureHandler(null);
      setSessionRefreshHandler(null);
    };
  }, [applyAuth, handleSessionRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoggingIn(true);
      const result = await apiPost<AuthPayload>("/auth/login", {
        email,
        password
      });

      const nextAuth = normalizeAuthPayload(result);
      if (!nextAuth || isTokenExpired(nextAuth.accessToken)) {
        throw new Error("Session expired. Please sign in again.");
      }

      await applyAuth(nextAuth);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your email and password.";
      Alert.alert("Login failed", message);
    } finally {
      setLoggingIn(false);
    }
  }, [applyAuth]);

  const logout = useCallback(async () => {
    const currentRefreshToken = refreshTokenRef.current;
    if (currentRefreshToken) {
      try {
        await fetch(`${getApiBaseUrl()}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: currentRefreshToken })
        });
      } catch {
        // ignore logout network error and clear local session anyway
      }
    }
    await applyAuth(null);
  }, [applyAuth]);

  const content = useMemo(() => {
    if (hydrating) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Restoring secure session...</Text>
        </View>
      );
    }

    if (!auth) {
      return <LoginScreen onLogin={login} loading={loggingIn} />;
    }

    if (auth.role === "COACH") {
      return <CoachTabs onLogout={() => logout().catch(() => null)} />;
    }

    if (auth.role === "MEMBER") {
      return <MemberTabs onLogout={() => logout().catch(() => null)} />;
    }

    return <AdminMobileNotice onLogout={() => logout().catch(() => null)} />;
  }, [auth, hydrating, loggingIn, login, logout]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading app...</Text>
      </View>
    );
  }

  return <NavigationContainer>{content}</NavigationContainer>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#f7f4ee"
  },
  loadingText: {
    fontSize: 16,
    color: "#1f2937"
  },
  cta: {
    backgroundColor: "#ff6a33",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  ctaText: {
    color: "#111827",
    fontWeight: "700"
  }
});
