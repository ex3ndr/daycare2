import { createRoute } from "@tanstack/react-router";
import { orgSlugRoute } from "./_workspace.$orgSlug";

type SearchParams = {
  q?: string;
};

export const searchRoute = createRoute({
  getParentRoute: () => orgSlugRoute,
  path: "search",
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = searchRoute.useSearch();
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          {q ? `Results for "${q}"` : "Search placeholder"}
        </p>
      </div>
    </div>
  );
}
