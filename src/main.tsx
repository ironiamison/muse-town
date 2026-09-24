import { createRoot } from "react-dom/client";
import App from "./port/PortLaborOS";
import "./diorama.css";
import "./port/port-os.css";
import "./port/labor.css";

createRoot(document.getElementById("root")!).render(<App />);
