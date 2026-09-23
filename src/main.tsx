import { createRoot } from "react-dom/client";
import App from "./AppLive";
import "./styles.css";
import "./real.css";
import "./live.css";
import "./town2d.css";

createRoot(document.getElementById("root")!).render(<App />);
