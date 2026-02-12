import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { themeColors } from "@/app/styles";

export function WorkspaceChatLayout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      <WorkspaceSidebar />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: themeColors.background,
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
});
