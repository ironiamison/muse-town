import { createRoot } from "react-dom/client";
import App from "./port/PortOS";
import "./diorama.css";
import "./port/port-os.css";

createRoot(document.getElementById("root")!).render(<App />);
