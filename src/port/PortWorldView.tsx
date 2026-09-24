import { Canvas } from "@react-three/fiber";
import PortWorld, { type WorldPresence } from "./PortWorld";

export default function PortWorldView({ presences }: { presences: WorldPresence[] }) {
  return (
    <Canvas
      shadows
      camera={{ position: [17, 14, 18], fov: 34, near: 0.1, far: 120 }}
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
    >
      <PortWorld
        mode="world"
        presences={presences}
        opportunities={[]}
        selectedOpportunityId={null}
        selectedMuseId={null}
        focus="BOARD"
        onSelectMuse={() => undefined}
        onSelectOpportunity={() => undefined}
        onSelectTerminal={() => undefined}
      />
    </Canvas>
  );
}
