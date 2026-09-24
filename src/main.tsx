import { createRoot } from "react-dom/client";
import App from "./port/PortApp";
import "./styles.css";
import "./real.css";
import "./live.css";
import "./diorama.css";
import "./port/port.css";

createRoot(document.getElementById("root")!).render(<App />);
