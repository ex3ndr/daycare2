import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { WorkspaceLayoutTopBar } from "./WorkspaceLayoutTopBar";
import { WorkspaceRail } from "./WorkspaceRail";
import { themeColors } from "@/app/styles";

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <WorkspaceLayoutTopBar />
      <View style={styles.contentRow}>
        <WorkspaceRail />
        <View style={styles.contentSurface}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    height: "100%",
    backgroundColor: themeColors.bgAccent,
  },
  contentRow: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
    minWidth: 0,
  },
  contentSurface: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    backgroundColor: themeColors.surface,
    borderRadius: 8,
    overflow: "hidden",
    margin: 4,
    marginLeft: 0,
  },
});
