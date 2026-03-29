import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/theme";

type Tone = "default" | "program" | "progress" | "booking" | "dark";

const toneStyle: Record<Tone, { backgroundColor: string; borderColor: string; accent: string }> = {
  default: {
    backgroundColor: "#ffffff",
    borderColor: colors.line,
    accent: "#d3cdc2"
  },
  program: {
    backgroundColor: colors.emberSoft,
    borderColor: "#ffd8c3",
    accent: colors.brand
  },
  progress: {
    backgroundColor: colors.mintSoft,
    borderColor: "#cbead8",
    accent: colors.mint
  },
  booking: {
    backgroundColor: colors.skySoft,
    borderColor: "#cedef8",
    accent: colors.sky
  },
  dark: {
    backgroundColor: "#151926",
    borderColor: "#23293b",
    accent: colors.lime
  }
};

export default function Card({
  children,
  tone = "default",
  style,
  noAccent = false
}: {
  children: ReactNode;
  tone?: Tone;
  style?: ViewStyle;
  noAccent?: boolean;
}) {
  const palette = toneStyle[tone];

  return (
    <View style={[styles.card, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }, style]}>
      {!noAccent && <View style={[styles.accent, { backgroundColor: palette.accent }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0f1018",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  accent: {
    width: 42,
    height: 4,
    borderRadius: 4,
    marginBottom: 10
  }
});
