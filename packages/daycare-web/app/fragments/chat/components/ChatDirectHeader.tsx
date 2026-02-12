import { StyleSheet, Text, View } from "react-native";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { themeColors } from "@/app/styles";

export function ChatDirectHeader({
  displayName,
  initials,
  avatarUrl,
  presence,
}: {
  displayName: string;
  initials: string;
  avatarUrl: string | null | undefined;
  presence: "online" | "away" | "offline" | undefined;
}) {
  return (
    <View style={styles.container}>
      <Avatar size="sm" presence={presence}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <Text style={styles.name} numberOfLines={1}>
        {displayName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
    backgroundColor: themeColors.background,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: themeColors.foreground,
    fontFamily: "Bricolage Grotesque, sans-serif",
  },
});
