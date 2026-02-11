import { createRoute } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { SettingsLayout } from "@/app/components/settings/SettingsLayout";

export const settingsRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "settings",
  component: SettingsPage,
});

function SettingsPage() {
  return <SettingsLayout />;
}
