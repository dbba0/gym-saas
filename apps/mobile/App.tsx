import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
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
import { apiPost, setAuthFailureHandler, setToken } from "./src/lib/api";
import { clearSession, loadSession, saveSession } from "./src/lib/secureSession";
import { isTokenExpired } from "./src/lib/jwt";

const Tab = createBottomTabNavigator();

type AuthState = {
  token: string;
  role: "MEMBER" | "COACH" | "ADMIN";
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

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold
  });

  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let mounted = true;

    setAuthFailureHandler((reason) => {
      setToken(null);
      clearSession().catch(() => null);
      if (!mounted) {
        return;
      }
      setAuth(null);
      Alert.alert(reason === "expired" ? "Session expired" : "Session invalid", "Please sign in again.");
    });

    loadSession()
      .then((session) => {
        if (!mounted) {
          return;
        }

        if (session && !isTokenExpired(session.token)) {
          setToken(session.token);
          setAuth({ token: session.token, role: session.role });
          return;
        }

        setToken(null);
        clearSession().catch(() => null);
      })
      .finally(() => {
        if (mounted) {
          setHydrating(false);
        }
      });

    return () => {
      mounted = false;
      setAuthFailureHandler(null);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoggingIn(true);
      const result = await apiPost<{ token: string; user: { role: AuthState["role"] } }>("/auth/login", {
        email,
        password
      });

      if (isTokenExpired(result.token)) {
        throw new Error("Session expired. Please sign in again.");
      }

      setToken(result.token);
      setAuth({ token: result.token, role: result.user.role });
      await saveSession({ token: result.token, role: result.user.role });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your email and password.";
      Alert.alert("Login failed", message);
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    setToken(null);
    clearSession().catch(() => null);
    setAuth(null);
  };

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
      return <CoachTabs onLogout={logout} />;
    }

    return <MemberTabs onLogout={logout} />;
  }, [auth, hydrating, loggingIn]);

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
    backgroundColor: "#f7f4ee"
  },
  loadingText: {
    fontSize: 16,
    color: "#1f2937"
  }
});
