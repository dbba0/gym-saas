import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Screen from "../components/Screen";
import Card from "../components/Card";
import { colors } from "../theme/theme";
import QRCode from "react-native-qrcode-svg";
import { apiGet } from "../lib/api";

type MemberQr = { qrToken: string };

export default function MemberQrScreen() {
  const [qrValue, setQrValue] = useState<string | null>(null);

  useEffect(() => {
    apiGet<MemberQr>("/members/me/qr")
      .then((result) => setQrValue(result.qrToken))
      .catch(() => null);
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>My QR</Text>
        <Text style={styles.subtitle}>Show at the entrance</Text>
      </View>

      <Card tone="dark">
        <View style={styles.qrWrapper}>
          {qrValue ? (
            <QRCode value={qrValue} size={200} color={colors.ink} backgroundColor="#fff" />
          ) : (
            <Text style={styles.qrNote}>Generating QR...</Text>
          )}
          <Text style={styles.qrLabel}>Atlas Gym Access</Text>
          <Text style={styles.qrNote}>{qrValue || "-"}</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.ink
  },
  subtitle: {
    color: "#5a5f6c"
  },
  qrWrapper: {
    alignItems: "center",
    gap: 12
  },
  qrLabel: {
    fontWeight: "700",
    fontSize: 16,
    color: "#f8fafc"
  },
  qrNote: {
    fontSize: 12,
    color: "#cbd5e1"
  }
});
