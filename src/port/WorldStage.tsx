import { Canvas } from "@react-three/fiber";
import type { PortActor, PortOpportunity, PortTerminal } from "../lib/economy";
import PortWorld, { type WorldPresence } from "./PortWorld";

export default function WorldStage({
  mode,
  presences,
  opportunities,
  selectedOpportunityId,
  selectedMuseId,
  focus,
  onSelectMuse,
  onSelectOpportunity,
  onSelectTerminal,
}: {
  mode: "network" | "world";
  presences: WorldPresence[];
  opportunities: PortOpportunity[];
  selectedOpportunityId: number | null;
  selectedMuseId: string | null;
  focus: PortTerminal | null;
  onSelectMuse: (actor: PortActor) => void;
  onSelectOpportunity: (opportunity: PortOpportunity) => void;
  onSelectTerminal: (terminal: PortTerminal) => void;
}) {
  return (
    <Canvas
      shadows
      camera={{ position: [17, 14, 18], fov: 34, near: 0.1, far: 120 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <PortWorld
        mode={mode}
        presences={presences}
        opportunities={opportunities}
        selectedOpportunityId={selectedOpportunityId}
        selectedMuseId={selectedMuseId}
        focus={focus}
        onSelectMuse={(presence) => onSelectMuse(presence.actor)}
        onSelectOpportunity={onSelectOpportunity}
        onSelectTerminal={onSelectTerminal}
      />
    </Canvas>
  );
}

