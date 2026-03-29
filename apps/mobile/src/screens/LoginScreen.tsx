import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";

export default function LoginScreen({
  onLogin,
  loading
}: {
  onLogin: (email: string, password: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const disabled = loading || !email.trim() || !password.trim();

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to manage your training.</Text>
        <Card>
          <View style={styles.form}>
            <TextInput
              placeholder="Email"
              autoCapitalize="none"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              placeholder="Password"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={[styles.button, disabled && styles.buttonDisabled]}
              onPress={() => onLogin(email.trim(), password)}
              disabled={disabled}
            >
              <Text style={styles.buttonText}>{loading ? "Signing in..." : "Login"}</Text>
            </TouchableOpacity>
          </View>
        </Card>
        <Text style={styles.helper}>Demo: member@atlasgym.local / member123</Text>
        <Text style={styles.helper}>Demo: coach@atlasgym.local / coach123</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: 16
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink
  },
  subtitle: {
    color: "#5a5f6c"
  },
  form: {
    gap: 12
  },
  input: {
    borderWidth: 1,
    borderColor: "#e4ded3",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff"
  },
  button: {
    backgroundColor: colors.brand,
    padding: 12,
    borderRadius: 14,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    fontWeight: "600",
    color: colors.ink
  },
  helper: {
    fontSize: 12,
    color: "#6b7280"
  }
});
