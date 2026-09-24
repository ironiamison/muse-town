import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  OPPORTUNITY_ROUTE,
  opportunityStation,
  type PortActor,
  type PortOpportunity,
  type PortTerminal,
} from "../lib/economy";

export type WorldPresence = {
  actor: PortActor;
  terminal: PortTerminal;
  seed: number;
  activeAt: number;
};

export const TERMINAL_POSITIONS: Record<PortTerminal, [number, number, number]> = {
  ARRIVALS: [-0.8, 0, 8.4],
  BOARD: [0, 0, 0.2],
  WORKS: [-5.8, 0, 1.8],
  MARKET: [5.8, 0, 1.6],
  ARENA: [4.9, 0, 6.2],
  LAB: [-4.8, 0, -4.8],
  VAULT: [2.2, 0, -5.9],
};

const MATERIAL = {
  limestone: "#c9c1ae",
  limestoneLight: "#ddd6c6",
  limestoneDark: "#918a79",
  ink: "#151817",
  carbon: "#232725",
  oxidized: "#3e5a50",
  rust: "#a94f32",
  signal: "#f05a2a",
  meta: "#477382",
  water: "#151f1e",
  settled: "#5b8068",
};

const TERMINAL_ACCENT: Record<PortTerminal, string> = {
  ARRIVALS: MATERIAL.limestoneLight,
  BOARD: MATERIAL.signal,
  WORKS: MATERIAL.rust,
  MARKET: MATERIAL.oxidized,
  ARENA: "#8a5d43",
  LAB: MATERIAL.meta,
  VAULT: MATERIAL.ink,
};

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seeded(seed: number, salt = 0) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function signTexture(label: string, detail: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext("2d")!;
  context.fillStyle = MATERIAL.ink;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 18, canvas.height);
  context.strokeStyle = "rgba(221,214,198,.35)";
  context.lineWidth = 2;
  context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  context.fillStyle = "#eee8dc";
  context.font = "700 72px Arial Narrow, Arial, sans-serif";
  context.textBaseline = "middle";
  context.fillText(label, 52, 78);
  context.fillStyle = "rgba(238,232,220,.62)";
  context.font = "600 28px Arial Narrow, Arial, sans-serif";
  context.fillText(detail, 54, 142);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function StructureSign({
  label,
  detail,
  accent,
  position,
  rotation = [0, 0, 0],
  width = 2.7,
}: {
  label: string;
  detail: string;
  accent: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
}) {
  const texture = useMemo(() => signTexture(label, detail, accent), [label, detail, accent]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width / 4, 1, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function Terrace({
  position,
  scale,
  rotation = 0,
  height = 0.32,
}: {
  position: [number, number, number];
  scale: [number, number];
  rotation?: number;
  height?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, -0.34, 0]} receiveShadow>
        <cylinderGeometry args={[scale[0] * 0.97, scale[0], height + 0.28, 8]} />
        <meshStandardMaterial color={MATERIAL.limestoneDark} roughness={0.96} />
      </mesh>
      <mesh receiveShadow>
        <cylinderGeometry args={[scale[0], scale[0], height, 8]} />
        <meshStandardMaterial color={MATERIAL.limestone} roughness={0.94} />
      </mesh>
      <mesh position={[0, height / 2 + 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale[0] * 0.78, scale[0] * 0.94, 8]} />
        <meshBasicMaterial color={MATERIAL.limestoneLight} transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function Bridge({
  from,
  to,
  width = 0.72,
  y = 0.38,
  dark = false,
}: {
  from: [number, number, number];
  to: [number, number, number];
  width?: number;
  y?: number;
  dark?: boolean;
}) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  return (
    <group position={[(from[0] + to[0]) / 2, y, (from[2] + to[2]) / 2]} rotation={[0, angle, 0]}>
      <mesh receiveShadow castShadow>
        <boxGeometry args={[width, 0.16, length]} />
        <meshStandardMaterial color={dark ? MATERIAL.carbon : MATERIAL.limestoneLight} roughness={0.9} />
      </mesh>
      <mesh position={[-width / 2 - 0.05, 0.12, 0]}>
        <boxGeometry args={[0.05, 0.18, length]} />
        <meshStandardMaterial color={MATERIAL.ink} roughness={0.86} />
      </mesh>
      <mesh position={[width / 2 + 0.05, 0.12, 0]}>
        <boxGeometry args={[0.05, 0.18, length]} />
        <meshStandardMaterial color={MATERIAL.ink} roughness={0.86} />
      </mesh>
    </group>
  );
}

function Water() {
  const mechanism = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mechanism.current) mechanism.current.rotation.z = state.clock.elapsedTime * 0.025;
  });
  return (
    <>
      <mesh position={[0, -0.78, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[26, 64]} />
        <meshStandardMaterial color={MATERIAL.water} roughness={0.72} metalness={0.08} />
      </mesh>
      <mesh ref={mechanism} position={[0, -0.745, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[13.8, 13.86, 96]} />
        <meshBasicMaterial color={MATERIAL.oxidized} transparent opacity={0.46} />
      </mesh>
      {[4.7, 9.2, 13.7].map((radius) => (
        <mesh key={radius} position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.025, 96]} />
          <meshBasicMaterial color={MATERIAL.limestoneLight} transparent opacity={0.09} />
        </mesh>
      ))}
    </>
  );
}

function BoardStructure({ activity }: { activity: number }) {
  return (
    <group position={TERMINAL_POSITIONS.BOARD}>
      <Terrace position={[0, 0.12, 0]} scale={[3.4, 3]} rotation={Math.PI / 8} height={0.38} />
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.8, 1.25, 2.5]} />
        <meshStandardMaterial color={MATERIAL.ink} roughness={0.74} />
      </mesh>
      <mesh position={[0, 1.54, -0.55]} castShadow>
        <boxGeometry args={[4.15, 0.2, 1.1]} />
        <meshStandardMaterial color={MATERIAL.limestoneLight} roughness={0.82} />
      </mesh>
      {Array.from({ length: 9 }, (_, index) => (
        <mesh key={index} position={[-1.82 + index * 0.455, 0.9, 1.266]}>
          <boxGeometry args={[0.32, 0.64, 0.035]} />
          <meshStandardMaterial
            color={index < Math.min(activity, 9) ? MATERIAL.signal : "#313633"}
            emissive={index < Math.min(activity, 9) ? MATERIAL.signal : "#000000"}
            emissiveIntensity={index < Math.min(activity, 9) ? 0.2 : 0}
            roughness={0.8}
          />
        </mesh>
      ))}
      <StructureSign
        label="THE BOARD"
        detail={`${activity} PORT FILE${activity === 1 ? "" : "S"}`}
        accent={MATERIAL.signal}
        position={[-0.2, 2.05, 1.27]}
        width={2.6}
      />
    </group>
  );
}

function WorksStructure({ activity }: { activity: number }) {
  return (
    <group position={TERMINAL_POSITIONS.WORKS} rotation={[0, 0.12, 0]}>
      <Terrace position={[0, 0.08, 0]} scale={[3.15, 2.7]} rotation={-0.18} height={0.34} />
      {[
        [-1.1, 0.64, -0.6, 1.65, 0.78, 2.2],
        [0.85, 0.5, 0.55, 1.4, 0.52, 1.65],
        [0.15, 0.4, -1.15, 2.0, 0.35, 0.68],
      ].map((part, index) => (
        <mesh key={index} position={[part[0], part[1], part[2]]} castShadow receiveShadow>
          <boxGeometry args={[part[3], part[4], part[5]]} />
          <meshStandardMaterial color={index === 1 ? MATERIAL.rust : MATERIAL.carbon} roughness={0.82} />
        </mesh>
      ))}
      <group position={[-0.2, 1.75, 0.2]}>
        <mesh position={[-1.55, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 2.4, 0.14]} />
          <meshStandardMaterial color={MATERIAL.ink} />
        </mesh>
        <mesh position={[1.55, 0, 0]} castShadow>
          <boxGeometry args={[0.14, 2.4, 0.14]} />
          <meshStandardMaterial color={MATERIAL.ink} />
        </mesh>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[3.25, 0.16, 0.16]} />
          <meshStandardMaterial color={MATERIAL.ink} />
        </mesh>
      </group>
      <StructureSign
        label="THE WORKS"
        detail={`${activity} ACTIVE MUSE${activity === 1 ? "" : "S"}`}
        accent={MATERIAL.rust}
        position={[-0.2, 2.9, 1.22]}
        rotation={[0, -0.12, 0]}
      />
    </group>
  );
}

function MarketStructure({ activity }: { activity: number }) {
  return (
    <group position={TERMINAL_POSITIONS.MARKET} rotation={[0, -0.14, 0]}>
      <Terrace position={[0, 0.08, 0]} scale={[3.15, 2.7]} rotation={0.16} height={0.34} />
      <mesh position={[-0.78, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.42, 0.38, 8, 28, Math.PI * 1.35]} />
        <meshStandardMaterial color={MATERIAL.oxidized} roughness={0.72} />
      </mesh>
      <mesh position={[0.88, 0.72, 0.25]} rotation={[Math.PI / 2, 0, Math.PI]} castShadow>
        <torusGeometry args={[1.22, 0.3, 8, 28, Math.PI * 1.28]} />
        <meshStandardMaterial color={MATERIAL.limestoneLight} roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[3.8, 0.2, 0.62]} />
        <meshStandardMaterial color={MATERIAL.ink} roughness={0.78} />
      </mesh>
      <StructureSign
        label="THE MARKET"
        detail={`${activity} PROVIDER${activity === 1 ? "" : "S"} OBSERVED`}
        accent={MATERIAL.oxidized}
        position={[0.15, 2.46, 1.0]}
        rotation={[0, 0.14, 0]}
      />
    </group>
  );
}

function ArenaStructure({ activity }: { activity: number }) {
  const blocks = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => {
        const angle = (index / 28) * Math.PI * 2;
        const radius = 1.65;
        return {
          position: [Math.cos(angle) * radius, 0.5 + (index % 2) * 0.12, Math.sin(angle) * radius] as [
            number,
            number,
            number,
          ],
          rotation: -angle,
        };
      }),
    [],
  );
  return (
    <group position={TERMINAL_POSITIONS.ARENA} rotation={[0, -0.18, 0]}>
      <Terrace position={[0, 0.03, 0]} scale={[3, 2.6]} rotation={-0.2} height={0.3} />
      {blocks.map((block, index) => (
        <mesh key={index} position={block.position} rotation={[0, block.rotation, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.68, 0.86]} />
          <meshStandardMaterial color={index % 4 === 0 ? MATERIAL.rust : MATERIAL.limestoneDark} roughness={0.88} />
        </mesh>
      ))}
      <mesh position={[0, 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.05, 32]} />
        <meshStandardMaterial color={MATERIAL.ink} roughness={0.8} />
      </mesh>
      <StructureSign
        label="THE ARENA"
        detail={activity ? `${activity} PUBLIC SIGNAL${activity === 1 ? "" : "S"}` : "NO EVENT ON RECORD"}
        accent="#8a5d43"
        position={[0, 2.65, 1.25]}
        rotation={[0, 0.18, 0]}
      />
    </group>
  );
}

function LabStructure({ activity }: { activity: number }) {
  return (
    <group position={TERMINAL_POSITIONS.LAB} rotation={[0, 0.2, 0]}>
      <Terrace position={[0, 0.06, 0]} scale={[2.85, 2.55]} rotation={0.26} height={0.34} />
      {[
        [-1.1, 1.2, 0.4, 0.72, 2.25],
        [0.05, 1.65, -0.35, 0.82, 3.15],
        [1.2, 0.95, 0.55, 0.66, 1.75],
      ].map((tower, index) => (
        <group key={index} position={[tower[0], tower[1], tower[2]]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[tower[3] * 0.72, tower[3], tower[4], 6]} />
            <meshStandardMaterial color={index === 1 ? MATERIAL.meta : MATERIAL.carbon} roughness={0.76} />
          </mesh>
          <mesh position={[0, tower[4] / 2 + 0.18, 0]} rotation={[0, index * 0.7, 0]}>
            <octahedronGeometry args={[tower[3] * 0.42, 0]} />
            <meshStandardMaterial color={MATERIAL.limestoneLight} roughness={0.7} />
          </mesh>
        </group>
      ))}
      <StructureSign
        label="THE LAB"
        detail={`${activity} CAPABILITY SIGNAL${activity === 1 ? "" : "S"}`}
        accent={MATERIAL.meta}
        position={[0, 3.62, 1.0]}
        rotation={[0, -0.2, 0]}
      />
    </group>
  );
}

function VaultStructure({ activity }: { activity: number }) {
  return (
    <group position={TERMINAL_POSITIONS.VAULT} rotation={[0, -0.1, 0]}>
      <Terrace position={[0, 0.02, 0]} scale={[3.1, 2.7]} rotation={0.18} height={0.4} />
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.9, 1.75, 2.9]} />
        <meshStandardMaterial color={MATERIAL.ink} roughness={0.72} />
      </mesh>
      <mesh position={[0, 2.02, -0.35]} castShadow>
        <boxGeometry args={[3.25, 0.4, 2.1]} />
        <meshStandardMaterial color={MATERIAL.carbon} roughness={0.74} />
      </mesh>
      <mesh position={[0, 1.1, 1.47]}>
        <boxGeometry args={[0.18, 1.25, 0.04]} />
        <meshStandardMaterial color={MATERIAL.signal} emissive={MATERIAL.signal} emissiveIntensity={0.18} />
      </mesh>
      <StructureSign
        label="THE VAULT"
        detail={activity ? `${activity} LEDGER SIGNAL${activity === 1 ? "" : "S"}` : "NO PUBLIC SETTLEMENT"}
        accent={MATERIAL.limestoneLight}
        position={[0.05, 2.66, 1.48]}
        rotation={[0, 0.1, 0]}
      />
    </group>
  );
}

function ArrivalsStructure({ activity }: { activity: number }) {
  return (
    <group position={TERMINAL_POSITIONS.ARRIVALS}>
      <Terrace position={[0, -0.04, 0]} scale={[2.5, 2.1]} rotation={Math.PI / 8} height={0.24} />
      <mesh position={[-1.25, 0.85, 0]} castShadow>
        <boxGeometry args={[0.28, 1.7, 0.46]} />
        <meshStandardMaterial color={MATERIAL.ink} />
      </mesh>
      <mesh position={[1.25, 0.85, 0]} castShadow>
        <boxGeometry args={[0.28, 1.7, 0.46]} />
        <meshStandardMaterial color={MATERIAL.ink} />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <boxGeometry args={[2.78, 0.16, 0.46]} />
        <meshStandardMaterial color={MATERIAL.ink} />
      </mesh>
      <mesh position={[0, 1.76, 0.25]}>
        <boxGeometry args={[2.15, 0.06, 0.02]} />
        <meshStandardMaterial color={MATERIAL.signal} emissive={MATERIAL.signal} emissiveIntensity={0.26} />
      </mesh>
      <StructureSign
        label="ARRIVALS"
        detail={`${activity} MUSE${activity === 1 ? "" : "S"} OBSERVED`}
        accent={MATERIAL.signal}
        position={[0, 2.35, 0.28]}
      />
    </group>
  );
}

function StaticNetwork() {
  const paths: Array<[PortTerminal, PortTerminal, boolean]> = [
    ["ARRIVALS", "BOARD", true],
    ["BOARD", "WORKS", false],
    ["BOARD", "MARKET", false],
    ["BOARD", "LAB", true],
    ["BOARD", "VAULT", true],
    ["MARKET", "ARENA", false],
    ["WORKS", "ARENA", true],
  ];
  return (
    <group>
      {paths.map(([from, to, dark]) => (
        <Bridge
          key={`${from}-${to}`}
          from={TERMINAL_POSITIONS[from]}
          to={TERMINAL_POSITIONS[to]}
          dark={dark}
          width={from === "ARRIVALS" ? 0.95 : 0.62}
        />
      ))}
    </group>
  );
}

function MuseEntity({
  presence,
  selected,
  onSelect,
}: {
  presence: WorldPresence;
  selected: boolean;
  onSelect?: (presence: WorldPresence) => void;
}) {
  const base = TERMINAL_POSITIONS[presence.terminal];
  const angle = seeded(presence.seed, 1) * Math.PI * 2;
  const radius = 1.0 + seeded(presence.seed, 2) * 1.25;
  const x = base[0] + Math.cos(angle) * radius;
  const z = base[2] + Math.sin(angle) * radius;
  const bob = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (bob.current) bob.current.position.y = 0.7 + Math.sin(state.clock.elapsedTime * 0.72 + presence.seed) * 0.025;
  });
  return (
    <group
      ref={bob}
      position={[x, 0.7, z]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect?.(presence);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh castShadow>
        <dodecahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color={MATERIAL.ink}
          roughness={0.56}
          metalness={0.18}
          emissive={selected ? TERMINAL_ACCENT[presence.terminal] : "#000000"}
          emissiveIntensity={selected ? 0.42 : 0}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.24, 0.025, 4, 12]} />
        <meshBasicMaterial color={TERMINAL_ACCENT[presence.terminal]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.07, 0]} />
        <meshBasicMaterial color={selected ? MATERIAL.signal : MATERIAL.limestoneLight} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.27, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.035, 0.62, 0.035]} />
          <meshBasicMaterial color={MATERIAL.signal} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function ribbonGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments = 48, y = 0.49) {
  const positions: number[] = [];
  const indices: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).multiplyScalar(width / 2);
    positions.push(point.x + side.x, y, point.z + side.z, point.x - side.x, y, point.z - side.z);
    if (index < segments) {
      const a = index * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function EconomicRoute({
  opportunity,
  selected,
  onSelect,
}: {
  opportunity: PortOpportunity;
  selected: boolean;
  onSelect?: (opportunity: PortOpportunity) => void;
}) {
  const destination = TERMINAL_POSITIONS[opportunity.terminal];
  const board = TERMINAL_POSITIONS.BOARD;
  const curve = useMemo(() => {
    const sign = destination[0] >= 0 ? 1 : -1;
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(board[0], 0, board[2]),
        new THREE.Vector3(board[0] + sign * 2.3, 0, board[2] + (destination[2] - board[2]) * 0.28),
        new THREE.Vector3(destination[0] * 0.76, 0, destination[2] * 0.76),
        new THREE.Vector3(destination[0], 0, destination[2]),
      ],
      false,
      "catmullrom",
      0.12,
    );
  }, [board, destination]);
  const geometry = useMemo(() => ribbonGeometry(curve, selected ? 0.24 : 0.15), [curve, selected]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const current = opportunityStation(opportunity.state);
  const runner = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!runner.current || current < 0) return;
    const limit = Math.max(0.14, current / (OPPORTUNITY_ROUTE.length - 1));
    const t = (state.clock.elapsedTime * 0.08 + (opportunity.id % 17) / 17) % limit;
    const point = curve.getPointAt(t);
    runner.current.position.set(point.x, 0.59, point.z);
  });

  return (
    <group
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect?.(opportunity);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={selected ? MATERIAL.signal : TERMINAL_ACCENT[opportunity.terminal]}
          emissive={selected ? MATERIAL.signal : "#000000"}
          emissiveIntensity={selected ? 0.42 : 0}
          roughness={0.78}
        />
      </mesh>
      {OPPORTUNITY_ROUTE.map((station, index) => {
        const point = curve.getPointAt(index / (OPPORTUNITY_ROUTE.length - 1));
        return (
          <mesh key={station} position={[point.x, 0.57, point.z]} castShadow={index <= current}>
            <boxGeometry args={[0.16, index === current ? 0.25 : 0.12, 0.16]} />
            <meshStandardMaterial
              color={index < current ? MATERIAL.ink : index === current ? MATERIAL.signal : MATERIAL.limestoneDark}
              roughness={0.82}
            />
          </mesh>
        );
      })}
      {current >= 0 && (
        <mesh ref={runner}>
          <boxGeometry args={[0.12, 0.08, 0.12]} />
          <meshBasicMaterial color={MATERIAL.limestoneLight} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function CameraSystem({
  mode,
  focus,
}: {
  mode: "network" | "world";
  focus: PortTerminal | null;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const transition = useRef({ started: performance.now(), mode });
  const destination = useMemo(
    () =>
      mode === "network"
        ? new THREE.Vector3(15.8, 15.2, 18.8)
        : new THREE.Vector3(11.8, 9.8, 13.2),
    [mode],
  );
  const target = useMemo(() => {
    if (mode === "world" && focus) {
      const point = TERMINAL_POSITIONS[focus];
      return new THREE.Vector3(point[0] * 0.48, 0.2, point[2] * 0.48);
    }
    return new THREE.Vector3(0, 0.25, 0.8);
  }, [mode, focus]);

  useEffect(() => {
    transition.current = { started: performance.now(), mode };
  }, [mode, focus]);

  useFrame((_, delta) => {
    const elapsed = performance.now() - transition.current.started;
    const moving = elapsed < 1150;
    if (moving || mode === "network") {
      const alpha = 1 - Math.exp(-delta * (moving ? 4.2 : 2.2));
      camera.position.lerp(destination, alpha);
      controls.current?.target.lerp(target, alpha);
      controls.current?.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={mode === "world"}
      enableDamping
      dampingFactor={0.08}
      enablePan
      enableRotate
      minDistance={7}
      maxDistance={27}
      minPolarAngle={0.42}
      maxPolarAngle={1.28}
      target={[target.x, target.y, target.z]}
    />
  );
}

function RenderBudget({ mode }: { mode: "network" | "world" }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const interval = window.setInterval(invalidate, mode === "world" ? 34 : 125);
    let frame = 0;
    const burstUntil = performance.now() + 1250;
    const burst = () => {
      invalidate();
      if (performance.now() < burstUntil) frame = requestAnimationFrame(burst);
    };
    frame = requestAnimationFrame(burst);
    return () => {
      window.clearInterval(interval);
      cancelAnimationFrame(frame);
    };
  }, [mode, invalidate]);
  return null;
}

export default function PortWorld({
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
  onSelectMuse?: (presence: WorldPresence) => void;
  onSelectOpportunity?: (opportunity: PortOpportunity) => void;
  onSelectTerminal?: (terminal: PortTerminal) => void;
}) {
  const counts = useMemo(() => {
    const result = new Map<PortTerminal, number>();
    presences.forEach((presence) => result.set(presence.terminal, (result.get(presence.terminal) || 0) + 1));
    return result;
  }, [presences]);

  const routed = opportunities.filter((opportunity) =>
    ["ROUTED", "IN_PROGRESS", "SUBMITTED", "COMPLETE", "SETTLED"].includes(opportunity.state),
  );

  const selectTerminal = (terminal: PortTerminal) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelectTerminal?.(terminal);
  };

  return (
    <>
      <color attach="background" args={["#111817"]} />
      <fog attach="fog" args={["#111817", 20, 44]} />
      <ambientLight intensity={0.58} color="#d7d4c8" />
      <hemisphereLight args={["#d8d2c3", "#17201f", 1.1]} />
      <directionalLight
        position={[9, 16, 10]}
        intensity={2.7}
        color="#fff0d2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />
      <Water />
      <StaticNetwork />

      <group onClick={selectTerminal("BOARD")}>
        <BoardStructure activity={opportunities.length} />
      </group>
      <group onClick={selectTerminal("WORKS")}>
        <WorksStructure activity={counts.get("WORKS") || 0} />
      </group>
      <group onClick={selectTerminal("MARKET")}>
        <MarketStructure activity={counts.get("MARKET") || 0} />
      </group>
      <group onClick={selectTerminal("ARENA")}>
        <ArenaStructure activity={counts.get("ARENA") || 0} />
      </group>
      <group onClick={selectTerminal("LAB")}>
        <LabStructure activity={counts.get("LAB") || 0} />
      </group>
      <group onClick={selectTerminal("VAULT")}>
        <VaultStructure activity={counts.get("VAULT") || 0} />
      </group>
      <group onClick={selectTerminal("ARRIVALS")}>
        <ArrivalsStructure activity={counts.get("ARRIVALS") || 0} />
      </group>

      {routed.slice(0, 12).map((opportunity) => (
        <EconomicRoute
          key={opportunity.id}
          opportunity={opportunity}
          selected={selectedOpportunityId === opportunity.id}
          onSelect={onSelectOpportunity}
        />
      ))}

      {presences.slice(0, 36).map((presence) => (
        <MuseEntity
          key={presence.actor.museId}
          presence={presence}
          selected={selectedMuseId === presence.actor.museId}
          onSelect={onSelectMuse}
        />
      ))}

      <CameraSystem mode={mode} focus={focus} />
      <RenderBudget mode={mode} />
    </>
  );
}

