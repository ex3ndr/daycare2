import { createRoute } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";
import { DevLayout } from "@/app/components/dev/DevLayout";
import type { DevTab } from "@/app/components/dev/DevLayout";

const VALID_TABS: DevTab[] = ["components"];

type DevSearchParams = {
  tab?: DevTab;
};

export const devRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "dev",
  validateSearch: (search: Record<string, unknown>): DevSearchParams => ({
    tab: typeof search.tab === "string" && VALID_TABS.includes(search.tab as DevTab)
      ? (search.tab as DevTab)
      : undefined,
  }),
  component: DevPage,
});

function DevPage() {
  const { tab } = devRoute.useSearch();
  return <DevLayout initialTab={tab} />;
}
