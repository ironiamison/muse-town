import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./AppLive";
import "./styles.css";
import "./real.css";
import "./live.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
