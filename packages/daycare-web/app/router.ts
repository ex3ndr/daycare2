import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { loginRoute } from "./routes/login";
import { orgsRoute } from "./routes/orgs";
import { workspaceRoute } from "./routes/_workspace";
import { orgSlugRoute } from "./routes/_workspace.$orgSlug";
import { orgSlugIndexRoute } from "./routes/_workspace.$orgSlug.index";
import { channelRoute } from "./routes/_workspace.$orgSlug.c.$channelId";
import { threadRoute } from "./routes/_workspace.$orgSlug.c.$channelId.t.$threadId";
import { dmRoute } from "./routes/_workspace.$orgSlug.dm.$dmId";
import { dmThreadRoute } from "./routes/_workspace.$orgSlug.dm.$dmId.t.$threadId";
import { searchRoute } from "./routes/_workspace.$orgSlug.search";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  orgsRoute,
  workspaceRoute.addChildren([
    orgSlugRoute.addChildren([
      orgSlugIndexRoute,
      channelRoute.addChildren([threadRoute]),
      dmRoute.addChildren([dmThreadRoute]),
      searchRoute,
    ]),
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: {
      token: null,
      orgSlug: null,
    },
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
