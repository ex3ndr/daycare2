import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { router } from "./router";
import { sessionGet } from "./lib/sessionStore";

function App() {
  const session = sessionGet();
  return (
    <RouterProvider
      router={router}
      context={{
        auth: {
          token: session?.token ?? null,
          orgSlug: null,
        },
      }}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
