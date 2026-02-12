import { Pressable, StyleSheet, Text, View } from "react-native";
import { Hash, Lock, Settings } from "lucide-react";
import { themeColors } from "@/app/styles";

export function ChatChannelHeader({
  channelName,
  channelVisibility,
  onSettingsOpen,
}: {
  channelName: string;
  channelVisibility: "public" | "private";
  onSettingsOpen: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {channelVisibility === "private" ? (
          <Lock size={16} color={themeColors.mutedForeground} />
        ) : (
          <Hash size={16} color={themeColors.mutedForeground} />
        )}
        <Text style={styles.name} numberOfLines={1}>
          {channelName}
        </Text>
        <View style={styles.spacer} />
        <Pressable
          style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
          onPress={onSettingsOpen}
        >
          <Settings size={14} color={themeColors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
    backgroundColor: themeColors.background,
  },
  row: {
    height: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "600",
    color: themeColors.foreground,
    fontFamily: "Bricolage Grotesque, sans-serif",
  },
  spacer: {
    flex: 1,
  },
  settingsButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsButtonPressed: {
    opacity: 0.7,
  },
});
