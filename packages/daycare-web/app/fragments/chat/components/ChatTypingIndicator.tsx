import { StyleSheet, Text, View } from "react-native";
import { themeColors } from "@/app/styles";

export function ChatTypingIndicator({ text }: { text: string | null }) {
  return (
    <View style={styles.container}>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 24,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  text: {
    fontSize: 12,
    color: themeColors.mutedForeground,
  },
});
