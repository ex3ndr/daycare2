import { StyleSheet, View } from "react-native";
import { useStorage } from "@/app/sync/AppContext";
import { useShallow } from "zustand/react/shallow";
import { themeColors } from "@/app/styles";
import { WorkspaceRailOrgButton } from "./components/WorkspaceRailOrgButton";
import { WorkspaceRailUserMenu } from "./components/WorkspaceRailUserMenu";

export function WorkspaceRail() {
  const { orgName, orgSlug } = useStorage(
    useShallow((s) => ({
      orgName: s.objects.context.orgName,
      orgSlug: s.objects.context.orgSlug,
    })),
  );

  return (
    <View style={styles.container}>
      <WorkspaceRailOrgButton orgName={orgName} orgSlug={orgSlug} />
      <View style={styles.spacer} />
      <WorkspaceRailUserMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 72,
    height: "100%",
    backgroundColor: themeColors.bgAccent,
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  spacer: {
    flex: 1,
  },
});
