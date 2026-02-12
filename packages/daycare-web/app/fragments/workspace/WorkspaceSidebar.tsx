import { useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Hash,
  Lock,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import { useApp, useStorage } from "@/app/sync/AppContext";
import { useUiStore } from "@/app/stores/uiStoreContext";
import { unreadCountForChannel, presenceForUser } from "@/app/sync/selectors";
import { channelOrderSort } from "@/app/lib/channelOrderSort";
import { channelOrderRead } from "./components/workspaceSidebarChannelOrder";
import { WorkspaceSidebarCreateChannelDialog } from "./components/WorkspaceSidebarCreateChannelDialog";
import { WorkspaceSidebarNewMessageDialog } from "./components/WorkspaceSidebarNewMessageDialog";
import { themeColors } from "@/app/styles";

const EMPTY_CHANNEL_MAP: Record<string, never> = {};
const EMPTY_DIRECT_MAP: Record<string, never> = {};
const EMPTY_READ_STATE_MAP: Record<string, never> = {};
const EMPTY_PRESENCE_MAP: Record<string, never> = {};

type SidebarChannel = {
  id: string;
  organizationId: string;
  name: string;
  topic: string | null;
  visibility: "public" | "private";
  createdAt: number;
  updatedAt: number;
  isJoined: boolean;
};

type SidebarDirect = {
  id: string;
  organizationId: string;
  createdAt: number;
  updatedAt: number;
  otherUser: {
    id: string;
    kind: "human" | "ai";
    username: string;
    firstName: string;
    lastName: string | null;
    avatarUrl: string | null;
  };
};

export function WorkspaceSidebar() {
  const navigate = useNavigate();
  const app = useApp();
  const orgSlug = useStorage((s) => s.objects.context.orgSlug);
  const orgName = useStorage((s) => s.objects.context.orgName);
  const orgId = useStorage((s) => s.objects.context.orgId);
  const mutate = useStorage((s) => s.mutate);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const channelMap = useStorage(useShallow((s) => s.objects.channel ?? EMPTY_CHANNEL_MAP));
  const directMap = useStorage(useShallow((s) => s.objects.direct ?? EMPTY_DIRECT_MAP));
  const readStates = useStorage(useShallow((s) => s.objects.readState ?? EMPTY_READ_STATE_MAP));
  const presenceMap = useStorage(useShallow((s) => s.objects.presence ?? EMPTY_PRESENCE_MAP));
  const location = useRouterState({ select: (s) => s.location });
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [dmDialogOpen, setDmDialogOpen] = useState(false);

  const activeId = useMemo(() => {
    const path = location.pathname;
    const channelMatch = path.match(/\/c\/([^/]+)/);
    if (channelMatch) return channelMatch[1];
    const dmMatch = path.match(/\/dm\/([^/]+)/);
    if (dmMatch) return dmMatch[1];
    return null;
  }, [location.pathname]);

  const channels = useMemo(() => {
    const orgChannels = Object.values(channelMap).filter(
      (channel): channel is SidebarChannel => channel.organizationId === orgId,
    );
    return channelOrderSort(orgChannels, channelOrderRead(orgId));
  }, [channelMap, orgId]);

  const directs = useMemo(
    () =>
      Object.values(directMap)
        .filter((direct): direct is SidebarDirect => direct.organizationId === orgId)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [directMap, orgId],
  );

  if (sidebarCollapsed) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() =>
          navigate({
            to: "/$orgSlug/settings",
            params: { orgSlug },
            search: { tab: "general" },
          })
        }
      >
        <Text style={styles.orgName} numberOfLines={1}>
          {orgName}
        </Text>
        <Settings size={16} color={themeColors.sidebarMutedForeground} />
      </Pressable>

      <View style={styles.separator} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Channels</Text>
          {channels.map((channel) => {
            const unread = unreadCountForChannel(
              { readState: readStates } as Parameters<typeof unreadCountForChannel>[0],
              channel.id,
            );
            const isActive = activeId === channel.id;
            return (
              <Pressable
                key={channel.id}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() =>
                  navigate({ to: "/$orgSlug/c/$channelId", params: { orgSlug, channelId: channel.id } })
                }
              >
                {channel.visibility === "private" ? (
                  <Lock size={14} color={themeColors.sidebarMutedForeground} />
                ) : (
                  <Hash size={14} color={themeColors.sidebarMutedForeground} />
                )}
                <Text
                  style={[styles.rowLabel, isActive && styles.rowLabelActive]}
                  numberOfLines={1}
                >
                  {channel.name}
                </Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable style={styles.row} onPress={() => setChannelDialogOpen(true)}>
            <Plus size={14} color={themeColors.sidebarMutedForeground} />
            <Text style={styles.rowLabel}>New channel</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Direct messages</Text>
          {directs.map((direct) => {
            const unread = unreadCountForChannel(
              { readState: readStates } as Parameters<typeof unreadCountForChannel>[0],
              direct.id,
            );
            const isActive = activeId === direct.id;
            const userPresence = presenceForUser(presenceMap, direct.otherUser.id);
            const displayName = direct.otherUser.lastName
              ? `${direct.otherUser.firstName} ${direct.otherUser.lastName}`
              : direct.otherUser.firstName;
            const initials = (
              (direct.otherUser.firstName[0] ?? "") +
              (direct.otherUser.lastName?.[0] ?? "")
            ).toUpperCase();

            return (
              <Pressable
                key={direct.id}
                style={[styles.row, isActive && styles.rowActive]}
                onPress={() =>
                  navigate({ to: "/$orgSlug/dm/$dmId", params: { orgSlug, dmId: direct.id } })
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials || "?"}</Text>
                  <View
                    style={[
                      styles.presenceDot,
                      userPresence === "online"
                        ? styles.presenceOnline
                        : userPresence === "away"
                          ? styles.presenceAway
                          : styles.presenceOffline,
                    ]}
                  />
                </View>
                <Text
                  style={[styles.rowLabel, isActive && styles.rowLabelActive]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable style={styles.row} onPress={() => setDmDialogOpen(true)}>
            <MessageSquare size={14} color={themeColors.sidebarMutedForeground} />
            <Text style={styles.rowLabel}>New message</Text>
          </Pressable>
        </View>
      </ScrollView>

      <WorkspaceSidebarCreateChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        onCreated={(channelId) => {
          setChannelDialogOpen(false);
          navigate({ to: "/$orgSlug/c/$channelId", params: { orgSlug, channelId } });
        }}
        mutate={mutate}
        api={app.api}
        token={app.token}
        orgId={app.orgId}
      />

      <WorkspaceSidebarNewMessageDialog
        open={dmDialogOpen}
        onOpenChange={setDmDialogOpen}
        onCreated={(dmId) => {
          setDmDialogOpen(false);
          app.syncDirects();
          navigate({ to: "/$orgSlug/dm/$dmId", params: { orgSlug, dmId } });
        }}
        api={app.api}
        token={app.token}
        orgId={app.orgId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    flexShrink: 0,
    height: "100%",
    backgroundColor: themeColors.sidebar,
    borderRightWidth: 1,
    borderRightColor: themeColors.sidebarBorder,
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  orgName: {
    flex: 1,
    color: themeColors.sidebarForeground,
    fontSize: 20,
    fontWeight: "600",
    marginRight: 8,
  },
  separator: {
    height: 1,
    backgroundColor: themeColors.sidebarBorder,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: {
    color: themeColors.sidebarMutedForeground,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  row: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  rowActive: {
    backgroundColor: themeColors.sidebarAccent,
  },
  rowLabel: {
    flex: 1,
    color: themeColors.sidebarMutedForeground,
    fontSize: 14,
  },
  rowLabelActive: {
    color: themeColors.sidebarAccentForeground,
    fontWeight: "600",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeColors.sidebarAccent,
  },
  badgeText: {
    color: themeColors.sidebarAccentForeground,
    fontSize: 12,
    fontWeight: "600",
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeColors.sidebarMuted,
    position: "relative",
  },
  avatarText: {
    fontSize: 9,
    fontWeight: "700",
    color: themeColors.sidebarForeground,
  },
  presenceDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    position: "absolute",
    right: -1,
    bottom: -1,
    borderWidth: 1,
    borderColor: themeColors.sidebar,
  },
  presenceOnline: {
    backgroundColor: themeColors.presenceOnline,
  },
  presenceAway: {
    backgroundColor: themeColors.presenceAway,
  },
  presenceOffline: {
    backgroundColor: themeColors.presenceOffline,
  },
});
