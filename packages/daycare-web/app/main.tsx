import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App(): JSX.Element {
  return <div>Daycare</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
