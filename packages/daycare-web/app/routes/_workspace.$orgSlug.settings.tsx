import { createRoute } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { SettingsLayout } from "@/app/components/settings/SettingsLayout";
import type { SettingsTab } from "@/app/components/settings/SettingsLayout";

const VALID_TABS: SettingsTab[] = ["general", "members", "invites", "domains"];

type SettingsSearchParams = {
  tab?: SettingsTab;
};

export const settingsRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "settings",
  validateSearch: (search: Record<string, unknown>): SettingsSearchParams => ({
    tab: typeof search.tab === "string" && VALID_TABS.includes(search.tab as SettingsTab)
      ? (search.tab as SettingsTab)
      : undefined,
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = settingsRoute.useSearch();
  return <SettingsLayout initialTab={tab} />;
}
