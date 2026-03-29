import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/theme";

export default function Screen({ children }: { children: any }) {
  return (
    <LinearGradient
      colors={["#fff2e9", "#f7f4ee"]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1
  },
  safe: {
    flex: 1,
    padding: 18,
    backgroundColor: "transparent"
  }
});
