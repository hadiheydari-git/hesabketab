import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Design-system CSS once at the app entry (brief §4.1), then the
// self-hosted Persian font, then app styles.
import "@kashi-ui/css";
import "vazirmatn/Vazirmatn-font-face.css";
import "../styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
