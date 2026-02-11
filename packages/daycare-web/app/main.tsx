import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "./styles.css";
import { router } from "./router";
import { sessionGet, sessionClear } from "./lib/sessionStore";
import { sessionRestore, type SessionRestoreResult } from "./lib/sessionRestore";
import { apiClientCreate } from "./daycare/api/apiClientCreate";
import { apiRequestSetUnauthorizedHandler } from "./daycare/api/apiRequest";
import { ToastContainer } from "./components/ToastContainer";

const api = apiClientCreate("");

function App() {
  // Start with synchronous read for instant render (avoids flash)
  const [authState, setAuthState] = useState(() => {
    const session = sessionGet();
    return { token: session?.token ?? null, orgSlug: session?.orgSlug ?? null };
  });
  const [ready, setReady] = useState(false);

  // Wire up the global 401 handler
  useEffect(() => {
    apiRequestSetUnauthorizedHandler(() => {
      sessionClear();
      setAuthState({ token: null, orgSlug: null });
    });
    return () => {
      apiRequestSetUnauthorizedHandler(() => {});
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    sessionRestore(api).then((result: SessionRestoreResult) => {
      if (cancelled) return;
      if (result.status === "restored") {
        setAuthState({ token: result.session.token, orgSlug: result.session.orgSlug ?? null });
      } else {
        // No session or expired — clear auth state
        setAuthState({ token: null, orgSlug: null });
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <>
      <RouterProvider
        router={router}
        context={{ auth: authState }}
      />
      <ToastContainer />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
