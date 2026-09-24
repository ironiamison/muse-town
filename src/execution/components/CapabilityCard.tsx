import {
  ArrowUpRight,
  Bot,
  Camera,
  ChartNoAxesCombined,
  PackageCheck,
  ScanEye,
  Search,
  Truck,
  UserRound,
  Wrench,
} from "lucide-react";
import type { Capability } from "../../lib/capabilities";
import { Link } from "../router";

function CapabilityIcon({ id }: { id: string }) {
  if (id.includes("photograph")) return <Camera />;
  if (id.includes("inspect") || id.includes("verify")) return <ScanEye />;
  if (id.includes("purchase") || id.includes("pickup")) return <PackageCheck />;
  if (id.includes("deliver")) return <Truck />;
  if (id.includes("research") || id.includes("search")) return <Search />;
  if (id.includes("analyze") || id.includes("monitor")) return <ChartNoAxesCombined />;
  if (id === "rent_human") return <UserRound />;
  if (id === "hire_agent") return <Bot />;
  return <Wrench />;
}

export default function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <Link href={`/capabilities/${capability.id}`} className="en-capability">
      <span className="en-capability__icon">
        <CapabilityIcon id={capability.id} />
      </span>
      <span className="en-capability__body">
        <small>
          {capability.category}
          <i className={`en-availability en-availability--${capability.availability}`}>
            {capability.availability === "experimental" ? "preview" : capability.availability}
          </i>
        </small>
        <strong>{capability.name}</strong>
        <p>{capability.description}</p>
        <code>{capability.id}</code>
      </span>
      <ArrowUpRight className="en-capability__arrow" aria-hidden="true" />
    </Link>
  );
}
