import { StyleSheet, Text, View } from "react-native";
import { themeColors } from "@/app/styles";

export function WorkspaceLayoutTopBar() {
  return (
    <div className="drag-region">
      <View style={styles.container}>
        <Text style={styles.title}>Daycare</Text>
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 30,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeColors.bgAccent,
  },
  title: {
    color: themeColors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
    opacity: 0.3,
  },
});
