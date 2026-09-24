import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

/* ------------------------------------------------------------------ */
/* Screen-space anchors published to the DOM overlay                    */
/* ------------------------------------------------------------------ */

export type Anchor = {
  id: string;
  kind: "district" | "pier" | "citizen" | "island";
  x: number;
  y: number;
  scale: number;
  depth: number;
  visible: boolean;
};

type AnchorListener = (anchors: Anchor[]) => void;
const anchorListeners = new Set<AnchorListener>();
export const anchorStore = {
  subscribe(listener: AnchorListener) {
    anchorListeners.add(listener);
    return () => {
      anchorListeners.delete(listener);
    };
  },
  publish(anchors: Anchor[]) {
    anchorListeners.forEach((listener) => listener(anchors));
  },
};

import type { Group, Mesh } from "three";
import * as THREE from "three";
import {
  createAvatar,
  resolveMuseMedia,
  type MusePost,
  type MuseResident,
} from "./lib/musebook";
import type { TownRoom } from "./lib/town";

/* ------------------------------------------------------------------ */
/* Types shared with AppLive                                           */
/* ------------------------------------------------------------------ */

type DistrictKind = "porch" | "workshop" | "market" | "hall" | "school";

type District = {
  id: string;
  name: string;
  verb: string;
  description: string;
  color: string;
  kind: DistrictKind;
  position: [number, number, number];
};

type WorldMuse = MusePost & { district: string; resident?: MuseResident };

export type Daypart = "day" | "sunset" | "night";

type TownProps = {
  districts: District[];
  muses: WorldMuse[];
  arrivals: WorldMuse[];
  rooms: TownRoom[];
  focusedDistrict: District | null;
  featuredMuse: WorldMuse | null;
  selectedMuse: WorldMuse | null;
  claimTotal: number;
  questDistrictId: string | null;
  daypart: Daypart;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: WorldMuse) => void;
  onSelectRoom: (room: TownRoom) => void;
  onOpenInvitation: () => void;
};

/* ------------------------------------------------------------------ */
/* Theme (day / sunset / night)                                        */
/* ------------------------------------------------------------------ */

type Theme = {
  background: string;
  fog: string;
  table: string;
  grass: string;
  grassDark: string;
  soil: string;
  path: string;
  plaza: string;
  water: string;
  waterDeep: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambient: number;
  windowGlow: number;
  lampGlow: number;
  lampLight: number;
  exposure: number;
};

const THEMES: Record<Daypart, Theme> = {
  day: {
    background: "#f3ecdd",
    fog: "#f3ecdd",
    table: "#efe6d4",
    grass: "#9fb58f",
    grassDark: "#8aa27c",
    soil: "#b89a78",
    path: "#dcc9a6",
    plaza: "#d8cbb4",
    water: "#8fb6bd",
    waterDeep: "#6f98a3",
    sunColor: "#fff2dc",
    sunIntensity: 2.6,
    sunPosition: [8, 14, 6],
    hemiSky: "#e9f0f5",
    hemiGround: "#b9a98c",
    hemiIntensity: 0.9,
    ambient: 0.35,
    windowGlow: 0,
    lampGlow: 0,
    lampLight: 0,
    exposure: 1.05,
  },
  sunset: {
    background: "#f0d9c4",
    fog: "#f0d9c4",
    table: "#e8cfb6",
    grass: "#9aa985",
    grassDark: "#83967a",
    soil: "#b08c6a",
    path: "#d8bd98",
    plaza: "#d3bfa4",
    water: "#b3a0a4",
    waterDeep: "#8a7a86",
    sunColor: "#ffb774",
    sunIntensity: 2.4,
    sunPosition: [-12, 6, 8],
    hemiSky: "#f4c8a8",
    hemiGround: "#8b6f60",
    hemiIntensity: 0.75,
    ambient: 0.3,
    windowGlow: 1.6,
    lampGlow: 1.8,
    lampLight: 0.8,
    exposure: 1.0,
  },
  night: {
    background: "#1b2335",
    fog: "#1b2335",
    table: "#202a3e",
    grass: "#3f5a58",
    grassDark: "#34494a",
    soil: "#3a3f4b",
    path: "#6d7580",
    plaza: "#5f6874",
    water: "#2f4a5e",
    waterDeep: "#233a4b",
    sunColor: "#9db4ff",
    sunIntensity: 0.9,
    sunPosition: [-6, 12, -8],
    hemiSky: "#5a6f9a",
    hemiGround: "#1a2230",
    hemiIntensity: 0.7,
    ambient: 0.28,
    windowGlow: 2.8,
    lampGlow: 3.2,
    lampLight: 1.6,
    exposure: 1.0,
  },
};

const ThemeContext = createContext<Theme>(THEMES.day);
const useTheme = () => useContext(ThemeContext);

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const LAYOUT: Record<string, { position: [number, number, number]; rotation: number }> = {
  lobby: { position: [0, 0, 0], rotation: 0 },
  townhall: { position: [0.3, 0, -5.4], rotation: 0 },
  museideas: { position: [-5.9, 0, -0.9], rotation: Math.PI / 2 },
  musemoneychallenge: { position: [5.9, 0, -0.5], rotation: -Math.PI / 2 },
  skillexchange: { position: [0.5, 0, 5.2], rotation: Math.PI },
};

const PIER: [number, number, number] = [-4.9, 0, 4.7];
const POND: [number, number, number] = [-3.1, 0, 3.55];

type V3 = [number, number, number];

function layoutFor(district: District) {
  return LAYOUT[district.id] || { position: district.position, rotation: 0 };
}

/** Where a citizen stands when "at" a district (in front of the building). */
function stationFor(id: string): THREE.Vector3 {
  const layout = LAYOUT[id] || LAYOUT.lobby;
  const [x, , z] = layout.position;
  if (id === "lobby") return new THREE.Vector3(0, 0, 0);
  const toward = new THREE.Vector3(-x, 0, -z).normalize().multiplyScalar(2.15);
  return new THREE.Vector3(x + toward.x, 0, z + toward.z);
}

const ROUTE_POINTS: Record<string, V3[]> = {
  townhall: [
    [0, 0, -1.9],
    [-0.35, 0, -2.7],
    [0.05, 0, -3.35],
  ],
  museideas: [
    [-1.9, 0, 0.1],
    [-2.7, 0, 0.3],
    [-3.75, 0, -0.55],
  ],
  musemoneychallenge: [
    [1.9, 0, -0.1],
    [2.75, 0, 0.25],
    [3.75, 0, -0.35],
  ],
  skillexchange: [
    [0.1, 0, 1.9],
    [0.7, 0, 2.7],
    [0.5, 0, 3.05],
  ],
  pier: [
    [-1.4, 0, 1.4],
    [-2.3, 0, 2.6],
    [-3.2, 0, 3.6],
    [-4.2, 0, 4.2],
  ],
};

const PLAZA_RING = 1.5;

const ROUTES: Record<string, THREE.CatmullRomCurve3> = Object.fromEntries(
  Object.entries(ROUTE_POINTS).map(([id, points]) => {
    const end = id === "pier" ? new THREE.Vector3(...PIER) : stationFor(id);
    const first = new THREE.Vector3(...points[0]);
    const start = first.clone().setY(0).normalize().multiplyScalar(PLAZA_RING);
    const list = [start, ...points.map((p) => new THREE.Vector3(...p)), end];
    return [id, new THREE.CatmullRomCurve3(list, false, "catmullrom", 0.35)];
  }),
);

/** Points along the plaza ring from angle a to angle b (shorter way). */
function ringArc(from: THREE.Vector3, to: THREE.Vector3) {
  const a = Math.atan2(from.z, from.x);
  let b = Math.atan2(to.z, to.x);
  while (b - a > Math.PI) b -= Math.PI * 2;
  while (b - a < -Math.PI) b += Math.PI * 2;
  const steps = Math.max(2, Math.round(Math.abs(b - a) / 0.25));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = a + ((b - a) * i) / steps;
    return new THREE.Vector3(Math.cos(t) * PLAZA_RING, 0, Math.sin(t) * PLAZA_RING);
  });
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function ribbonGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments = 48, y = 0) {
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).multiplyScalar(width / 2);
    positions.push(point.x + side.x, y, point.z + side.z, point.x - side.x, y, point.z - side.z);
    uvs.push(0, t, 1, t);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function museKey(muse: WorldMuse) {
  return muse.muse_id || muse.name;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function excerpt(text: string, max = 90) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */

function Terrain() {
  const theme = useTheme();
  const bumps = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2 + 0.4;
        const radius = 7.4 + ((i * 37) % 10) / 6;
        return {
          position: [Math.cos(angle) * radius, 0.24, Math.sin(angle) * radius] as V3,
          scale: [1.3 + (i % 3) * 0.4, 0.22 + (i % 2) * 0.1, 1.1 + ((i + 1) % 3) * 0.35] as V3,
        };
      }),
    [],
  );
  return (
    <group>
      {/* table */}
      <mesh position={[0, -0.9, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={theme.table} roughness={1} />
      </mesh>
      {/* soil side */}
      <mesh position={[0, -0.32, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[10.4, 9.9, 0.62, 72]} />
        <meshStandardMaterial color={theme.soil} roughness={1} />
      </mesh>
      {/* grass top */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[10.45, 10.45, 0.16, 72]} />
        <meshStandardMaterial color={theme.grass} roughness={1} />
      </mesh>
      {/* gentle berms */}
      {bumps.map((bump, i) => (
        <mesh key={i} position={bump.position} scale={bump.scale} receiveShadow castShadow>
          <sphereGeometry args={[1, 18, 10]} />
          <meshStandardMaterial color={i % 2 ? theme.grassDark : theme.grass} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Paths() {
  const theme = useTheme();
  const geometries = useMemo(
    () => Object.values(ROUTES).map((curve) => ribbonGeometry(curve, 0.72, 56, 0.15)),
    [],
  );
  return (
    <group>
      {geometries.map((geometry, i) => (
        <mesh key={i} geometry={geometry} receiveShadow>
          <meshStandardMaterial color={theme.path} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Pond() {
  const theme = useTheme();
  const water = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!water.current) return;
    water.current.position.y = 0.1 + Math.sin(clock.elapsedTime * 0.8) * 0.006;
    (water.current.material as THREE.MeshStandardMaterial).opacity =
      0.88 + Math.sin(clock.elapsedTime * 1.3) * 0.04;
  });
  return (
    <group position={POND}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.55, 40]} />
        <meshStandardMaterial color={theme.waterDeep} roughness={0.4} />
      </mesh>
      <mesh ref={water} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.15, 1, 1]}>
        <circleGeometry args={[1.32, 40]} />
        <meshStandardMaterial color={theme.water} roughness={0.15} metalness={0.05} transparent />
      </mesh>
      {/* stone rim */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 1.62 * 1.1, 0.16, Math.sin(angle) * 1.5]}
            rotation={[0, angle, 0]}
            castShadow
          >
            <boxGeometry args={[0.28, 0.12, 0.18]} />
            <meshStandardMaterial color="#c9bea9" roughness={1} />
          </mesh>
        );
      })}
      {/* bridge across pond along the pier path */}
      <group position={[-0.05, 0.22, 0.05]} rotation={[0, Math.PI / 4, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.08, 3.1]} />
          <meshStandardMaterial color="#8a6a4e" roughness={0.9} />
        </mesh>
        {[-0.4, 0.4].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.22, 0]}>
              <boxGeometry args={[0.05, 0.05, 3.0]} />
              <meshStandardMaterial color="#6e533d" />
            </mesh>
            {[-1.3, -0.65, 0, 0.65, 1.3].map((z) => (
              <mesh key={z} position={[x, 0.12, z]}>
                <boxGeometry args={[0.05, 0.24, 0.05]} />
                <meshStandardMaterial color="#6e533d" />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

function Tree({ position, scale = 1, variant = 0 }: { position: V3; scale?: number; variant?: number }) {
  const canopy = useRef<Group>(null);
  const phase = position[0] * 1.7 + position[2] * 0.9;
  useFrame(({ clock }) => {
    if (!canopy.current) return;
    canopy.current.rotation.z = Math.sin(clock.elapsedTime * 0.7 + phase) * 0.018;
    canopy.current.rotation.x = Math.cos(clock.elapsedTime * 0.5 + phase) * 0.014;
  });
  const greens = [
    ["#6f8f5f", "#7fa06c"],
    ["#5f7f58", "#728f63"],
    ["#8aa06a", "#9db07a"],
  ][variant % 3];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 0.84, 8]} />
        <meshStandardMaterial color="#7a5a42" roughness={1} />
      </mesh>
      <group ref={canopy} position={[0, 0.82, 0]}>
        <mesh position={[0, 0.34, 0]} castShadow>
          <sphereGeometry args={[0.52, 14, 10]} />
          <meshStandardMaterial color={greens[0]} roughness={1} flatShading />
        </mesh>
        <mesh position={[0.22, 0.6, 0.1]} castShadow>
          <sphereGeometry args={[0.36, 12, 8]} />
          <meshStandardMaterial color={greens[1]} roughness={1} flatShading />
        </mesh>
        <mesh position={[-0.24, 0.55, -0.08]} castShadow>
          <sphereGeometry args={[0.32, 12, 8]} />
          <meshStandardMaterial color={greens[1]} roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  );
}

function Shrub({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.28, 10, 7]} />
        <meshStandardMaterial color="#7d9a68" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.2, 0.16, 0.08]} castShadow>
        <sphereGeometry args={[0.2, 10, 7]} />
        <meshStandardMaterial color="#8faa74" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function Lamp({ position }: { position: V3 }) {
  const theme = useTheme();
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.045, 1.1, 8]} />
        <meshStandardMaterial color="#2b3038" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.18, 0.2, 0.18]} />
        <meshStandardMaterial
          color="#ffe0b0"
          emissive="#ffc27a"
          emissiveIntensity={theme.lampGlow}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <coneGeometry args={[0.16, 0.1, 4]} />
        <meshStandardMaterial color="#2b3038" />
      </mesh>
      {theme.lampLight > 0 && (
        <pointLight position={[0, 1.1, 0]} color="#ffc98a" intensity={theme.lampLight} distance={3.4} decay={2} />
      )}
    </group>
  );
}

function Bench({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.7, 0.05, 0.24]} />
        <meshStandardMaterial color="#9a7455" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.4, -0.1]} rotation={[-0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.26, 0.04]} />
        <meshStandardMaterial color="#9a7455" roughness={0.9} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.1, 0]}>
          <boxGeometry args={[0.05, 0.2, 0.2]} />
          <meshStandardMaterial color="#3a3f47" />
        </mesh>
      ))}
    </group>
  );
}

function Fence({ position, rotation = 0, length = 2 }: { position: V3; rotation?: number; length?: number }) {
  const posts = Math.max(2, Math.round(length / 0.5) + 1);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {Array.from({ length: posts }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (i / (posts - 1)) * length, 0.2, 0]} castShadow>
          <boxGeometry args={[0.06, 0.4, 0.06]} />
          <meshStandardMaterial color="#e9ddc7" roughness={1} />
        </mesh>
      ))}
      {[0.14, 0.3].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[length, 0.04, 0.03]} />
          <meshStandardMaterial color="#e9ddc7" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Crate({ position, rotation = 0, size = 0.32 }: { position: V3; rotation?: number; size?: number }) {
  return (
    <mesh position={[position[0], position[1] + size / 2, position[2]]} rotation={[0, rotation, 0]} castShadow>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color="#b98a5e" roughness={1} />
    </mesh>
  );
}

function Mailbox({ position }: { position: V3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
        <meshStandardMaterial color="#3a3f47" />
      </mesh>
      <mesh position={[0, 0.66, 0]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.26]} />
        <meshStandardMaterial color="#c96a4a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Window({
  position,
  size = [0.26, 0.34],
  rotation = 0,
  frame = "#f6efe2",
}: {
  position: V3;
  size?: [number, number];
  rotation?: number;
  frame?: string;
}) {
  const theme = useTheme();
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[size[0] + 0.06, size[1] + 0.06, 0.03]} />
        <meshStandardMaterial color={frame} roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <boxGeometry args={[size[0], size[1], 0.02]} />
        <meshStandardMaterial
          color={theme.windowGlow > 0 ? "#ffd9a3" : "#7c8fa0"}
          emissive="#ffc27a"
          emissiveIntensity={theme.windowGlow}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Door({ position, rotation = 0, color = "#5b4a3d" }: { position: V3; rotation?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh>
        <boxGeometry args={[0.44, 0.7, 0.04]} />
        <meshStandardMaterial color="#f6efe2" roughness={1} />
      </mesh>
      <mesh position={[0, -0.02, 0.02]}>
        <boxGeometry args={[0.34, 0.62, 0.02]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Sign({
  position,
  rotation = 0,
  color,
  width = 1.1,
}: {
  position: V3;
  rotation?: number;
  color: string;
  width?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[width, 0.26, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[width - 0.16, 0.12, 0.01]} />
        <meshStandardMaterial color="#f6efe2" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* District architecture                                               */
/* ------------------------------------------------------------------ */

function CommonsPlaza({ color }: { color: string }) {
  const theme = useTheme();
  const water = useRef<Mesh>(null);
  const jet = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.rotation.z = clock.elapsedTime * 0.12;
    if (jet.current) jet.current.scale.y = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
  });
  return (
    <group>
      <mesh position={[0, 0.17, 0]} receiveShadow>
        <cylinderGeometry args={[2.75, 2.75, 0.08, 56]} />
        <meshStandardMaterial color={theme.plaza} roughness={1} />
      </mesh>
      <mesh position={[0, 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.18, 56]} />
        <meshStandardMaterial color="#c9b898" roughness={1} />
      </mesh>
      {/* fountain */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.98, 1.05, 0.22, 32]} />
        <meshStandardMaterial color="#d9d0bd" roughness={0.9} />
      </mesh>
      <mesh ref={water} position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.86, 32]} />
        <meshStandardMaterial color={theme.water} roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 0.42, 16]} />
        <meshStandardMaterial color="#d9d0bd" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.44, 0.36, 0.12, 24]} />
        <meshStandardMaterial color="#d9d0bd" roughness={0.9} />
      </mesh>
      <mesh ref={jet} position={[0, 1.12, 0]}>
        <coneGeometry args={[0.08, 0.34, 10]} />
        <meshStandardMaterial color={theme.water} transparent opacity={0.85} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* benches + lamps + planters around */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const r = 2.05;
        return (
          <group key={i}>
            <Bench position={[Math.cos(angle) * r, 0.21, Math.sin(angle) * r]} rotation={-angle - Math.PI / 2} />
            <group position={[Math.cos(angle + 0.42) * 2.45, 0.21, Math.sin(angle + 0.42) * 2.45]}>
              <mesh position={[0, 0.14, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.18, 0.28, 12]} />
                <meshStandardMaterial color="#c96a4a" roughness={1} />
              </mesh>
              <mesh position={[0, 0.38, 0]}>
                <sphereGeometry args={[0.22, 10, 7]} />
                <meshStandardMaterial color="#7d9a68" flatShading roughness={1} />
              </mesh>
            </group>
          </group>
        );
      })}
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2;
        return <Lamp key={i} position={[Math.cos(angle) * 2.5, 0.21, Math.sin(angle) * 2.5]} />;
      })}
    </group>
  );
}

function WorksBuilding({ color }: { color: string }) {
  const wheel = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (wheel.current) wheel.current.rotation.x += delta * 0.4;
  });
  return (
    <group>
      {/* yard */}
      <mesh position={[0, 0.17, 0.6]} receiveShadow>
        <boxGeometry args={[4.4, 0.06, 3.6]} />
        <meshStandardMaterial color="#cbbba0" roughness={1} />
      </mesh>
      {/* main hall */}
      <mesh position={[0, 0.95, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.5, 2.2]} />
        <meshStandardMaterial color="#e4c7a5" roughness={1} />
      </mesh>
      {/* flat roof + sawtooth skylights */}
      <mesh position={[0, 1.73, -0.5]} castShadow>
        <boxGeometry args={[3.5, 0.08, 2.3]} />
        <meshStandardMaterial color="#b8583c" roughness={0.9} />
      </mesh>
      {[-1.13, 0, 1.13].map((x) => (
        <group key={x} position={[x, 1.77, -0.5]}>
          <mesh position={[0.12, 0.26, 0]} rotation={[0, 0, -0.5]} castShadow>
            <boxGeometry args={[1.05, 0.06, 2.1]} />
            <meshStandardMaterial color="#c96a4a" roughness={0.9} />
          </mesh>
          <mesh position={[-0.42, 0.25, 0]}>
            <boxGeometry args={[0.05, 0.5, 2.05]} />
            <meshStandardMaterial color="#a9c3d1" roughness={0.25} metalness={0.1} />
          </mesh>
        </group>
      ))}
      {/* chimney */}
      <mesh position={[-1.25, 2.3, -1.2]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 1.1, 10]} />
        <meshStandardMaterial color="#5c5a5e" roughness={0.8} />
      </mesh>
      {/* big workshop door + windows */}
      <mesh position={[-0.7, 0.62, 0.61]}>
        <boxGeometry args={[1.1, 1.0, 0.05]} />
        <meshStandardMaterial color="#5b6f7a" roughness={0.7} />
      </mesh>
      {[-1.0, -0.7, -0.4].map((x) => (
        <mesh key={x} position={[x, 0.62, 0.64]}>
          <boxGeometry args={[0.02, 1.0, 0.02]} />
          <meshStandardMaterial color="#3d4a52" />
        </mesh>
      ))}
      <Window position={[0.55, 1.0, 0.62]} size={[0.5, 0.42]} />
      <Window position={[1.2, 1.0, 0.62]} size={[0.32, 0.42]} />
      {/* lean-to with tools */}
      <mesh position={[2.0, 0.55, -0.5]} castShadow>
        <boxGeometry args={[0.9, 0.7, 1.6]} />
        <meshStandardMaterial color="#d8b58f" roughness={1} />
      </mesh>
      <mesh position={[2.0, 0.98, -0.5]} rotation={[0, 0, -0.32]} castShadow>
        <boxGeometry args={[1.05, 0.05, 1.7]} />
        <meshStandardMaterial color="#b8583c" roughness={0.9} />
      </mesh>
      {/* gear */}
      <mesh ref={wheel} position={[-1.85, 1.15, -0.5]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <torusGeometry args={[0.36, 0.07, 8, 14]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
      </mesh>
      {/* crates and barrels */}
      <Crate position={[1.4, 0.2, 1.4]} rotation={0.2} />
      <Crate position={[1.75, 0.2, 1.15]} rotation={-0.3} size={0.26} />
      <Crate position={[1.55, 0.52, 1.35]} rotation={0.5} size={0.22} />
      <mesh position={[-1.7, 0.42, 1.5]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.44, 12]} />
        <meshStandardMaterial color="#8a6a4e" roughness={1} />
      </mesh>
      <Sign position={[0, 1.95, 0.64]} color="#3b4650" width={1.4} />
      <Lamp position={[2.0, 0.2, 1.7]} />
    </group>
  );
}

function MarketRow({ color }: { color: string }) {
  const stalls = [
    { x: -1.5, wall: "#f0dfc4", awning: "#c96a4a" },
    { x: 0, wall: "#e6cfae", awning: "#5b7f6a" },
    { x: 1.5, wall: "#f2e4cf", awning: "#d9a066" },
  ];
  return (
    <group>
      <mesh position={[0, 0.17, 0.7]} receiveShadow>
        <boxGeometry args={[5.0, 0.06, 3.4]} />
        <meshStandardMaterial color="#d3c3a6" roughness={1} />
      </mesh>
      {stalls.map((stall, i) => (
        <group key={i} position={[stall.x, 0, 0]}>
          <mesh position={[0, 0.95, -0.4]} castShadow receiveShadow>
            <boxGeometry args={[1.42, 1.5 + (i % 2) * 0.25, 1.9]} />
            <meshStandardMaterial color={stall.wall} roughness={1} />
          </mesh>
          {/* roof */}
          <mesh position={[0, 1.82 + (i % 2) * 0.25, -0.4]} rotation={[0, 0, 0]} castShadow>
            <boxGeometry args={[1.56, 0.12, 2.05]} />
            <meshStandardMaterial color={i === 1 ? "#b8583c" : "#8a6a4e"} roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.05 + (i % 2) * 0.25, -0.4]} castShadow>
            <boxGeometry args={[1.2, 0.34, 1.7]} />
            <meshStandardMaterial color={i === 1 ? "#c96a4a" : "#9c7a5d"} roughness={0.9} />
          </mesh>
          {/* awning (striped) */}
          <group position={[0, 1.3, 0.85]} rotation={[0.42, 0, 0]}>
            {Array.from({ length: 6 }, (_, s) => (
              <mesh key={s} position={[-0.58 + s * 0.232, 0, 0]} castShadow>
                <boxGeometry args={[0.232, 0.03, 0.8]} />
                <meshStandardMaterial color={s % 2 ? "#f6efe2" : stall.awning} roughness={1} />
              </mesh>
            ))}
          </group>
          <Window position={[0, 0.9, 0.56]} size={[0.8, 0.5]} />
          <Door position={[0.0, 0.55, 0.56]} color="#6b4e3a" />
          {/* counter / stall */}
          <mesh position={[0, 0.42, 1.35]} castShadow>
            <boxGeometry args={[1.0, 0.46, 0.44]} />
            <meshStandardMaterial color="#9a7455" roughness={1} />
          </mesh>
          {[0, 1, 2].map((g) => (
            <mesh key={g} position={[-0.3 + g * 0.3, 0.72, 1.35]} castShadow>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshStandardMaterial
                color={["#c96a4a", "#e0b25a", "#7d9a68"][(g + i) % 3]}
                roughness={0.8}
              />
            </mesh>
          ))}
          <Sign position={[0, 1.62, 0.6]} color={i === 1 ? color : "#3b4650"} width={1.0} />
        </group>
      ))}
      <Lamp position={[-2.4, 0.2, 1.7]} />
      <Lamp position={[2.4, 0.2, 1.7]} />
      <Mailbox position={[2.2, 0.2, 0.5]} />
      <Crate position={[-2.3, 0.2, 0.3]} rotation={0.4} size={0.26} />
    </group>
  );
}

function AssemblyHall({ color }: { color: string }) {
  return (
    <group>
      {/* steps */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.2 + i * 0.1, 1.55 - i * 0.22]} receiveShadow castShadow>
          <boxGeometry args={[3.6 - i * 0.2, 0.1, 0.8 - i * 0.18]} />
          <meshStandardMaterial color="#d9d0bd" roughness={1} />
        </mesh>
      ))}
      {/* plinth */}
      <mesh position={[0, 0.35, -0.1]} receiveShadow castShadow>
        <boxGeometry args={[3.6, 0.2, 2.6]} />
        <meshStandardMaterial color="#d0c6b2" roughness={1} />
      </mesh>
      {/* body */}
      <mesh position={[0, 1.15, -0.45]} castShadow receiveShadow>
        <boxGeometry args={[3.1, 1.4, 1.8]} />
        <meshStandardMaterial color="#efe3cf" roughness={1} />
      </mesh>
      {/* colonnade */}
      {[-1.25, -0.75, -0.25, 0.25, 0.75, 1.25].map((x) => (
        <mesh key={x} position={[x, 1.15, 0.75]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 1.4, 12]} />
          <meshStandardMaterial color="#f6efe2" roughness={1} />
        </mesh>
      ))}
      {/* entablature + pediment */}
      <mesh position={[0, 1.95, 0.1]} castShadow>
        <boxGeometry args={[3.4, 0.22, 2.1]} />
        <meshStandardMaterial color="#e8dcc6" roughness={1} />
      </mesh>
      <GableRoof width={3.5} height={0.7} depth={2.2} color="#c96a4a" position={[0, 2.06, 0.1]} />
      {/* dome */}
      <mesh position={[0, 2.05, -0.6]} castShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.3, 24]} />
        <meshStandardMaterial color="#e8dcc6" roughness={1} />
      </mesh>
      <mesh position={[0, 2.2, -0.6]} castShadow>
        <sphereGeometry args={[0.68, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 2.95, -0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 6]} />
        <meshStandardMaterial color="#e0b25a" metalness={0.5} roughness={0.4} />
      </mesh>
      <Door position={[0, 0.85, 0.46]} color="#3b4650" />
      <Window position={[-0.9, 1.25, 0.46]} size={[0.3, 0.5]} />
      <Window position={[0.9, 1.25, 0.46]} size={[0.3, 0.5]} />
      {/* flags */}
      {[-1.9, 1.9].map((x) => (
        <group key={x} position={[x, 0.45, 1.3]}>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 6]} />
            <meshStandardMaterial color="#3a3f47" />
          </mesh>
          <mesh position={[0.18, 1.35, 0]}>
            <boxGeometry args={[0.34, 0.2, 0.02]} />
            <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <Lamp position={[-1.6, 0.2, 2.2]} />
      <Lamp position={[1.6, 0.2, 2.2]} />
      <Shrub position={[-2.1, 0.2, 0.4]} />
      <Shrub position={[2.1, 0.2, 0.4]} scale={0.9} />
    </group>
  );
}

function SchoolAcademy({ color }: { color: string }) {
  return (
    <group>
      {/* courtyard */}
      <mesh position={[0, 0.17, 0.8]} receiveShadow>
        <boxGeometry args={[4.6, 0.06, 2.6]} />
        <meshStandardMaterial color="#d8cbb4" roughness={1} />
      </mesh>
      {/* main library */}
      <mesh position={[0, 1.05, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.7, 1.9]} />
        <meshStandardMaterial color="#e9d6b8" roughness={1} />
      </mesh>
      <GableRoof width={2.9} height={0.95} depth={2.1} color="#5b7f6a" position={[0, 1.9, -0.6]} />
      {/* wings */}
      {[-1.9, 1.9].map((x) => (
        <group key={x} position={[x, 0, 0.3]}>
          <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.1, 2.4]} />
            <meshStandardMaterial color="#f0e2c9" roughness={1} />
          </mesh>
          <GableRoof width={1.3} height={0.55} depth={2.6} color="#b8583c" position={[0, 1.3, 0]} />
          <Window position={[x < 0 ? 0.56 : -0.56, 0.75, 0.3]} size={[0.3, 0.42]} rotation={x < 0 ? Math.PI / 2 : -Math.PI / 2} />
          <Window position={[x < 0 ? 0.56 : -0.56, 0.75, -0.5]} size={[0.3, 0.42]} rotation={x < 0 ? Math.PI / 2 : -Math.PI / 2} />
        </group>
      ))}
      {/* arched entry + tall windows */}
      <Door position={[0, 0.65, 0.36]} color="#5b7f6a" />
      {[-0.8, 0.8].map((x) => (
        <Window key={x} position={[x, 1.1, 0.36]} size={[0.34, 0.8]} />
      ))}
      {/* bell tower */}
      <mesh position={[1.05, 2.45, -1.2]} castShadow>
        <boxGeometry args={[0.5, 1.6, 0.5]} />
        <meshStandardMaterial color="#f0e2c9" roughness={1} />
      </mesh>
      <mesh position={[1.05, 3.45, -1.2]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.45, 0.6, 4]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[1.05, 3.05, -1.2]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#e0b25a" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* book stack + reading bench in courtyard */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-1.4 + i * 0.02, 0.25 + i * 0.1, 1.5]} rotation={[0, i * 0.3, 0]} castShadow>
          <boxGeometry args={[0.36, 0.1, 0.26]} />
          <meshStandardMaterial color={["#c96a4a", "#5b7f6a", "#e0b25a"][i]} roughness={1} />
        </mesh>
      ))}
      <Bench position={[1.3, 0.21, 1.6]} rotation={Math.PI} />
      <Sign position={[0, 1.75, 0.38]} color={color} width={1.2} />
      <Tree position={[-2.0, 0.2, 1.9]} scale={0.7} variant={2} />
      <Lamp position={[2.2, 0.2, 1.9]} />
    </group>
  );
}

function DistrictBuilding({ district, claimTotal }: { district: District; claimTotal: number }) {
  void claimTotal;
  switch (district.kind) {
    case "porch":
      return <CommonsPlaza color={district.color} />;
    case "workshop":
      return <WorksBuilding color={district.color} />;
    case "market":
      return <MarketRow color={district.color} />;
    case "hall":
      return <AssemblyHall color={district.color} />;
    default:
      return <SchoolAcademy color={district.color} />;
  }
}

function DistrictGround({
  district,
  active,
  quest,
  onSelect,
}: {
  district: District;
  active: boolean;
  quest: boolean;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const ring = useRef<Mesh>(null);
  const beacon = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const material = ring.current.material as THREE.MeshBasicMaterial;
      material.opacity = active ? 0.55 + Math.sin(clock.elapsedTime * 2) * 0.15 : 0;
    }
    if (beacon.current) {
      beacon.current.position.y = 3.6 + Math.sin(clock.elapsedTime * 1.6) * 0.12;
      beacon.current.rotation.y = clock.elapsedTime * 0.6;
    }
  });
  const isPlaza = district.kind === "porch";
  return (
    <group>
      {!isPlaza && (
        <mesh position={[0, 0.13, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(district.id); }}>
          <cylinderGeometry args={[3.0, 3.1, 0.08, 40]} />
          <meshStandardMaterial color={theme.grassDark} roughness={1} />
        </mesh>
      )}
      {isPlaza && (
        <mesh position={[0, 0.12, 0]} onClick={(e) => { e.stopPropagation(); onSelect(district.id); }}>
          <cylinderGeometry args={[3.0, 3.0, 0.02, 40]} />
          <meshStandardMaterial color={theme.grass} roughness={1} />
        </mesh>
      )}
      <mesh ref={ring} position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.0, 3.1, 64]} />
        <meshBasicMaterial color={district.color} transparent opacity={0} toneMapped={false} />
      </mesh>
      {quest && (
        <group ref={beacon} position={[0, 3.6, 0]}>
          <mesh>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial color="#ffd9a3" emissive="#c96a4a" emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Arrivals pier                                                       */
/* ------------------------------------------------------------------ */

function ArrivalsPier({ arrivals, onOpen }: { arrivals: WorldMuse[]; onOpen: () => void }) {
  void arrivals;
  void onOpen;
  return (
    <group position={PIER}>
      <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.2, 0.1, 1.6]} />
        <meshStandardMaterial color="#8a6a4e" roughness={1} />
      </mesh>
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]}>
          <boxGeometry args={[0.03, 0.02, 1.55]} />
          <meshStandardMaterial color="#6e533d" />
        </mesh>
      ))}
      <Fence position={[0, 0.22, -0.78]} length={2.1} />
      <Lamp position={[-1.0, 0.22, 0.6]} />
      <Mailbox position={[0.95, 0.22, 0.6]} />
      <Sign position={[0, 0.9, 0.79]} color="#3b4650" width={1.3} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Citizens                                                            */
/* ------------------------------------------------------------------ */

type CitizenState = {
  key: string;
  muse: WorldMuse;
  location: string;
  target: string;
  position: THREE.Vector3;
  heading: number;
  route: THREE.Vector3[] | null;
  routeIndex: number;
  idleUntil: number;
  spot: THREE.Vector3;
  walkPhase: number;
};

const SPOT_OFFSETS = [
  [0, 0.75],
  [-0.85, 0.35],
  [0.85, 0.4],
  [-0.45, 1.25],
  [0.5, 1.25],
  [-1.25, 0.9],
  [1.25, 0.85],
  [0, 1.7],
];

function spotFor(id: string, slot: number) {
  const station = stationFor(id);
  const [ox, oz] = SPOT_OFFSETS[slot % SPOT_OFFSETS.length];
  if (id === "lobby") {
    const angle = (slot / SPOT_OFFSETS.length) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * 2.15, 0, Math.sin(angle) * 2.15);
  }
  const layout = LAYOUT[id];
  // rotate offset so "forward" faces the plaza center
  const dir = new THREE.Vector3(-layout.position[0], 0, -layout.position[2]).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  return station.clone().add(side.multiplyScalar(ox)).add(dir.multiplyScalar(-oz * 0.5));
}

function routeBetween(from: string, to: string): THREE.Vector3[] {
  const sample = (curve: THREE.CatmullRomCurve3, reverse: boolean) => {
    const points = curve.getSpacedPoints(26);
    return reverse ? points.reverse() : points;
  };
  if (from === to) return [];
  if (from === "lobby") return sample(ROUTES[to], false);
  if (to === "lobby") return sample(ROUTES[from], true);
  const back = sample(ROUTES[from], true);
  const out = sample(ROUTES[to], false);
  return [...back, ...ringArc(back[back.length - 1], out[0]), ...out];
}

function GableRoof({
  width,
  height,
  depth,
  color,
  position,
  rotation = 0,
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  position: V3;
  rotation?: number;
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return geo;
  }, [width, height, depth]);
  return (
    <mesh geometry={geometry} position={position} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function Citizen({
  state,
  color,
  selected,
  featured,
  onSelect,
  register,
}: {
  state: CitizenState;
  color: string;
  selected: boolean;
  featured: boolean;
  onSelect: (muse: WorldMuse) => void;
  register: (key: string, group: Group | null) => void;
}) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.06;
      ring.current.scale.set(s, s, s);
    }
  });
  const coat = useMemo(() => new THREE.Color(color).lerp(new THREE.Color("#f3ecdd"), 0.18), [color]);
  return (
    <group
      ref={(node) => register(state.key, node)}
      position={state.position}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(state.muse);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.18} />
      </mesh>
      {(selected || featured) && (
        <mesh ref={ring} position={[0, 0.225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.42, 32]} />
          <meshBasicMaterial color={selected ? "#c96a4a" : color} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      )}
      <group userData={{ body: true }}>
        {[-0.06, 0.06].map((x) => (
          <mesh key={x} position={[x, 0.36, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.16, 4, 8]} />
            <meshStandardMaterial color="#3a3f47" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0.66, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.3, 6, 12]} />
          <meshStandardMaterial color={coat} roughness={0.85} />
        </mesh>
        <mesh position={[0.15, 0.6, 0.02]} castShadow>
          <boxGeometry args={[0.08, 0.12, 0.16]} />
          <meshStandardMaterial color="#8a6a4e" roughness={1} />
        </mesh>
        {/* neck / head core (the PFP disc is drawn by the DOM overlay) */}
        <mesh position={[0, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color="#f0dcc4" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

const MAX_CITIZENS = 14;
const WALK_SPEED = 0.95;

function Citizens({
  muses,
  districts,
  selectedMuse,
  featuredMuse,
  onSelect,
  onPositions,
}: {
  muses: WorldMuse[];
  districts: District[];
  selectedMuse: WorldMuse | null;
  featuredMuse: WorldMuse | null;
  onSelect: (muse: WorldMuse) => void;
  onPositions: (positions: Map<string, THREE.Vector3>) => void;
}) {
  const statesRef = useRef<Map<string, CitizenState>>(new Map());
  const nodes = useRef<Map<string, Group>>(new Map());
  const [, bump] = useState(0);
  const districtById = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);

  // Reconcile roster with real records.
  useEffect(() => {
    const states = statesRef.current;
    const now = performance.now();
    const wanted = muses.slice(0, MAX_CITIZENS);
    const keys = new Set(wanted.map(museKey));
    for (const key of [...states.keys()]) if (!keys.has(key)) states.delete(key);
    wanted.forEach((muse, index) => {
      const key = museKey(muse);
      const existing = states.get(key);
      if (existing) {
        const changedRecord = existing.muse.id !== muse.id;
        existing.muse = muse;
        if (changedRecord && existing.target !== muse.district) {
          // a new public post in another district → walk there
          existing.route = routeBetween(existing.location, muse.district);
          existing.routeIndex = 0;
          existing.target = muse.district;
          existing.spot = spotFor(muse.district, index);
        }
        return;
      }
      const spot = spotFor(muse.district, index);
      states.set(key, {
        key,
        muse,
        location: muse.district,
        target: muse.district,
        position: spot.clone(),
        heading: 0,
        route: null,
        routeIndex: 0,
        idleUntil: now + 4000 + (hashString(key) % 14000),
        spot,
        walkPhase: hashString(key) % 100,
      });
    });
    bump((n) => n + 1);
  }, [muses]);

  const positions = useMemo(() => new Map<string, THREE.Vector3>(), []);

  useFrame(({ clock }, delta) => {
    const now = performance.now();
    const dt = Math.min(delta, 0.05);
    statesRef.current.forEach((state) => {
      const node = nodes.current.get(state.key);
      if (state.route && state.route.length) {
        const waypoint = state.routeIndex < state.route.length ? state.route[state.routeIndex] : state.spot;
        const dir = waypoint.clone().sub(state.position);
        dir.y = 0;
        const dist = dir.length();
        const step = WALK_SPEED * dt;
        if (dist <= step) {
          state.position.copy(waypoint);
          if (state.routeIndex >= state.route.length) {
            state.route = null;
            state.location = state.target;
            state.idleUntil = now + 9000 + (hashString(state.key + state.muse.id) % 16000);
          } else {
            state.routeIndex += 1;
          }
        } else {
          dir.normalize();
          state.position.addScaledVector(dir, step);
          const targetHeading = Math.atan2(dir.x, dir.z);
          let diff = targetHeading - state.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          state.heading += diff * Math.min(1, dt * 8);
        }
        state.walkPhase += dt * 11;
      } else if (now >= state.idleUntil) {
        // Wander: visit the Commons or another district, then return home to the real district.
        const home = state.muse.district;
        let destination: string;
        if (state.location !== home) destination = home;
        else {
          const others = ["lobby", ...districts.map((d) => d.id)].filter((id) => id !== state.location);
          destination = others[(hashString(state.key) + Math.floor(clock.elapsedTime)) % others.length];
        }
        state.target = destination;
        state.spot = spotFor(destination, hashString(state.key) % SPOT_OFFSETS.length);
        state.route = routeBetween(state.location, destination);
        state.routeIndex = 0;
      }
      if (node) {
        node.position.copy(state.position);
        node.rotation.y = state.heading;
        const body = node.children.find((child) => child.userData?.body) as Group | undefined;
        if (body) {
          const walking = Boolean(state.route);
          body.position.y = walking ? Math.abs(Math.sin(state.walkPhase)) * 0.045 : Math.sin(clock.elapsedTime * 1.6 + state.walkPhase) * 0.008;
          body.rotation.z = walking ? Math.sin(state.walkPhase) * 0.05 : 0;
        }
      }
      positions.set(state.key, state.position);
    });
    onPositions(positions);
  });

  const selectedKey = selectedMuse ? museKey(selectedMuse) : null;
  const featuredKey = featuredMuse ? museKey(featuredMuse) : null;

  return (
    <group>
      {[...statesRef.current.values()].map((state) => {
        const district = districtById.get(state.muse.district);
        return (
          <Citizen
            key={state.key}
            state={state}
            color={district?.color || "#c96a4a"}
            selected={selectedKey === state.key}
            featured={featuredKey === state.key && selectedKey !== state.key}
            onSelect={onSelect}
            register={(key, node) => {
              if (node) nodes.current.set(key, node);
              else nodes.current.delete(key);
            }}
          />
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Camera rig: fixed isometric-ish angle, pan + zoom, smooth focus     */
/* ------------------------------------------------------------------ */

const AZIMUTH = 0.34;
const ELEVATION = 0.86;

function CameraRig({
  focus,
  selectedKey,
  positions,
}: {
  focus: District | null;
  selectedKey: string | null;
  positions: MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const { camera, gl, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.3, 0.2));
  const desiredTarget = useRef(new THREE.Vector3(0, 0.3, 0.2));
  const distance = useRef(38);
  const desiredDistance = useRef(38);
  const manual = useRef(false);
  const lastFocus = useRef<string | null>(null);
  const lastSelected = useRef<string | null>(null);

  useEffect(() => {
    const aspect = size.width / size.height;
    const base = aspect < 1 ? 52 : aspect < 1.4 ? 44 : 38;
    if (!manual.current && !focus && !selectedKey) desiredDistance.current = base;
  }, [size, focus, selectedKey]);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinch: number | null = null;
    const pointers = new Map<number, { x: number; y: number }>();
    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) {
          desiredDistance.current = THREE.MathUtils.clamp(desiredDistance.current * (pinch / d), 9, 50);
          manual.current = true;
        }
        pinch = d;
        return;
      }
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) < 1) return;
      const scale = distance.current / size.height * 1.15;
      const right = new THREE.Vector3(Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH));
      const forward = new THREE.Vector3(-Math.sin(AZIMUTH), 0, -Math.cos(AZIMUTH));
      desiredTarget.current.addScaledVector(right, -dx * scale).addScaledVector(forward, dy * scale);
      desiredTarget.current.x = THREE.MathUtils.clamp(desiredTarget.current.x, -9, 9);
      desiredTarget.current.z = THREE.MathUtils.clamp(desiredTarget.current.z, -9, 9);
      manual.current = true;
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      desiredDistance.current = THREE.MathUtils.clamp(
        desiredDistance.current * Math.exp(event.deltaY * 0.0016),
        9,
        50,
      );
      manual.current = true;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, size.height]);

  useFrame(() => {
    if (focus && lastFocus.current !== focus.id) {
      lastFocus.current = focus.id;
      manual.current = false;
      const layout = layoutFor(focus);
      desiredTarget.current.set(layout.position[0], 0.6, layout.position[2] + 0.4);
      desiredDistance.current = 17;
    } else if (!focus && lastFocus.current) {
      lastFocus.current = null;
      if (!selectedKey) {
        desiredTarget.current.set(0, 0.3, 0.2);
        desiredDistance.current = size.width / size.height < 1.4 ? 44 : 38;
      }
    }
    if (selectedKey && lastSelected.current !== selectedKey) {
      lastSelected.current = selectedKey;
      manual.current = false;
    }
    if (!selectedKey) lastSelected.current = null;
    if (selectedKey && !manual.current) {
      const position = positions.current.get(selectedKey);
      if (position) {
        desiredTarget.current.set(position.x, 0.6, position.z);
        desiredDistance.current = Math.min(desiredDistance.current, 13);
      }
    }
    target.current.lerp(desiredTarget.current, 0.06);
    distance.current += (desiredDistance.current - distance.current) * 0.07;
    const d = distance.current;
    camera.position.set(
      target.current.x + Math.sin(AZIMUTH) * Math.cos(ELEVATION) * d,
      target.current.y + Math.sin(ELEVATION) * d,
      target.current.z + Math.cos(AZIMUTH) * Math.cos(ELEVATION) * d,
    );
    camera.lookAt(target.current);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Muse-made rooms: floating islands off the edge of town              */
/*                                                                     */
/* Every island corresponds to one real, signed public record with the */
/* `[musetown.world/room v1]` marker. Nothing is placed speculatively.  */
/* ------------------------------------------------------------------ */

const MAX_ISLANDS = 8;
// Slots sit just off the disc edge (radius 10.45 + island 1.45) in the open
// screen regions of the default framing: a bottom-right archipelago and a
// left-hand chain. Later slots drift behind the town; the camera is free.
const ISLAND_SLOTS: Array<{ angle: number; radius: number }> = [
  { angle: 0.37, radius: 12.2 },
  { angle: 2.48, radius: 12.3 },
  { angle: 0.41, radius: 15.1 },
  { angle: 2.75, radius: 12.7 },
  { angle: 0.61, radius: 12.7 },
  { angle: 3.0, radius: 12.75 },
  { angle: 4.4, radius: 12.6 },
  { angle: 5.0, radius: 12.6 },
];
const ISLAND_BASE_Y = 1.1;
const ISLAND_PALETTE = ["#c86b4a", "#7e9a6e", "#d9a24a", "#4d6276", "#a8677a", "#5f8d8a"];

function islandSlot(index: number): V3 {
  const slot = ISLAND_SLOTS[index % ISLAND_SLOTS.length];
  return [Math.cos(slot.angle) * slot.radius, ISLAND_BASE_Y, Math.sin(slot.angle) * slot.radius];
}

function Island({
  room,
  index,
  selected,
  onSelect,
  onPosition,
}: {
  room: TownRoom;
  index: number;
  selected: boolean;
  onSelect: (room: TownRoom) => void;
  onPosition: (id: string, position: THREE.Vector3) => void;
}) {
  const theme = useTheme();
  const group = useRef<Group>(null);
  const base = useMemo(() => islandSlot(index), [index]);
  const seed = hashString(room.id);
  const color = ISLAND_PALETTE[seed % ISLAND_PALETTE.length];
  const phase = (seed % 628) / 100;
  const facing = Math.atan2(-base[0], -base[2]);
  const members = room.members.slice(0, 6);
  const [hover, setHover] = useState(false);

  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const t = clock.getElapsedTime();
    node.position.set(base[0], base[1] + Math.sin(t * 0.55 + phase) * 0.16, base[2]);
    node.rotation.z = Math.sin(t * 0.4 + phase) * 0.012;
    node.rotation.x = Math.cos(t * 0.35 + phase) * 0.012;
    onPosition(room.id, node.position);
  });

  const lift = selected || hover ? 0.05 : 0;

  return (
    <group
      ref={group}
      position={base}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(room);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <group position={[0, lift, 0]}>
        {/* grass top */}
        <mesh position={[0, 0, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.45, 1.35, 0.22, 24]} />
          <meshStandardMaterial color={selected ? theme.grassDark : theme.grass} roughness={1} />
        </mesh>
        {/* soil underside tapering to a point */}
        <mesh position={[0, -0.62, 0]} castShadow>
          <cylinderGeometry args={[1.32, 0.28, 1.05, 24]} />
          <meshStandardMaterial color={theme.soil} roughness={1} />
        </mesh>
        {/* loose stones drifting beneath */}
        <mesh position={[0.35, -1.45, 0.2]}>
          <dodecahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color={theme.soil} roughness={1} />
        </mesh>
        <mesh position={[-0.4, -1.7, -0.1]}>
          <dodecahedronGeometry args={[0.09, 0]} />
          <meshStandardMaterial color={theme.soil} roughness={1} />
        </mesh>

        {/* one small house, facing town */}
        <group position={[0.25, 0.11, -0.15]} rotation={[0, facing, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, 0.6, 0.66]} />
            <meshStandardMaterial color="#f1e6d2" roughness={0.95} />
          </mesh>
          <GableRoof width={0.92} height={0.4} depth={0.8} color={color} position={[0, 0.6, 0]} />
          <Door position={[0, 0.0, 0.34]} />
          <Window position={[-0.24, 0.36, 0.34]} />
          <Window position={[0.24, 0.36, 0.34]} />
        </group>

        <Tree position={[-0.8, 0.1, 0.35]} scale={0.62} variant={seed % 3} />
        <Shrub position={[0.95, 0.1, 0.55]} scale={0.55} />

        {/* flag with the room's colour */}
        <group position={[-0.55, 0.11, -0.75]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.1, 8]} />
            <meshStandardMaterial color="#5b4a3d" roughness={1} />
          </mesh>
          <mesh position={[0.17, 0.98, 0]}>
            <boxGeometry args={[0.34, 0.2, 0.02]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        </group>

        {/* members present: one peg per Muse that founded or joined */}
        {members.map((member, i) => {
          const angle = -0.3 + (i / Math.max(members.length, 1)) * Math.PI * 1.15;
          const r = 0.85;
          const hue = hashString(member.muse_id || member.name) % 360;
          return (
            <group key={member.id} position={[Math.cos(angle) * r - 0.1, 0.11, Math.sin(angle) * r + 0.25]}>
              <mesh position={[0, 0.17, 0]} castShadow>
                <capsuleGeometry args={[0.085, 0.16, 4, 8]} />
                <meshStandardMaterial color={`hsl(${hue} 34% ${i === 0 ? 38 : 52}%)`} roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.4, 0]} castShadow>
                <sphereGeometry args={[0.09, 12, 10]} />
                <meshStandardMaterial color="#f3dfc7" roughness={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

function Islands({
  rooms,
  selectedRoomId,
  onSelect,
  positions,
}: {
  rooms: TownRoom[];
  selectedRoomId: string | null;
  onSelect: (room: TownRoom) => void;
  positions: MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const onPosition = (id: string, position: THREE.Vector3) => {
    const existing = positions.current.get(id);
    if (existing) existing.copy(position);
    else positions.current.set(id, position.clone());
  };
  useEffect(() => {
    const keep = new Set(rooms.map((room) => room.id));
    for (const key of [...positions.current.keys()]) if (!keep.has(key)) positions.current.delete(key);
  }, [rooms, positions]);
  return (
    <group>
      {rooms.slice(0, MAX_ISLANDS).map((room, index) => (
        <Island
          key={room.id}
          room={room}
          index={index}
          selected={selectedRoomId === room.id}
          onSelect={onSelect}
          onPosition={onPosition}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Projector: publishes screen-space anchors for the DOM overlay        */
/* ------------------------------------------------------------------ */

const HEAD_HEIGHT = 1.12;

function Projector({
  districts,
  positions,
  islands,
}: {
  districts: District[];
  positions: MutableRefObject<Map<string, THREE.Vector3>>;
  islands: MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const { camera, size } = useThree();
  const scratch = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const anchors: Anchor[] = [];
    const project = (id: string, kind: Anchor["kind"], x: number, y: number, z: number, base: number) => {
      scratch.set(x, y, z);
      const depth = camera.position.distanceTo(scratch);
      scratch.project(camera);
      const visible = scratch.z < 1 && Math.abs(scratch.x) < 1.2 && Math.abs(scratch.y) < 1.2;
      anchors.push({
        id,
        kind,
        x: ((scratch.x + 1) / 2) * size.width,
        y: ((1 - scratch.y) / 2) * size.height,
        scale: THREE.MathUtils.clamp(base / depth, 0.55, 1.7),
        depth,
        visible,
      });
    };
    districts.forEach((district) => {
      const layout = layoutFor(district);
      const isPlaza = district.kind === "porch";
      project(
        district.id,
        "district",
        layout.position[0],
        isPlaza ? 0.9 : 3.9,
        layout.position[2] + (isPlaza ? -3.1 : 0),
        26,
      );
    });
    project("pier", "pier", PIER[0], 1.7, PIER[2], 26);
    positions.current.forEach((position, key) => {
      project(key, "citizen", position.x, HEAD_HEIGHT, position.z, 30);
    });
    islands.current.forEach((position, key) => {
      project(key, "island", position.x, position.y + 1.75, position.z, 26);
    });
    anchorStore.publish(anchors);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function Scenery() {
  const trees: Array<{ position: V3; scale: number; variant: number }> = [
    { position: [-3.4, 0.2, -4.6], scale: 1.1, variant: 0 },
    { position: [3.9, 0.2, -4.4], scale: 0.95, variant: 1 },
    { position: [-7.6, 0.2, -3.8], scale: 1.0, variant: 2 },
    { position: [7.8, 0.2, 2.8], scale: 1.05, variant: 0 },
    { position: [-7.4, 0.2, 3.2], scale: 0.9, variant: 1 },
    { position: [4.2, 0.2, 4.2], scale: 1.0, variant: 2 },
    { position: [-2.2, 0.2, 6.9], scale: 0.9, variant: 0 },
    { position: [3.0, 0.2, 7.4], scale: 1.1, variant: 1 },
    { position: [-6.6, 0.2, -6.4], scale: 0.85, variant: 2 },
    { position: [6.4, 0.2, -6.2], scale: 0.9, variant: 0 },
    { position: [-1.4, 0.2, -7.8], scale: 1.0, variant: 1 },
    { position: [8.2, 0.2, -2.6], scale: 0.95, variant: 2 },
    { position: [-8.6, 0.2, 0.6], scale: 1.0, variant: 0 },
    { position: [1.9, 0.2, -2.6], scale: 0.7, variant: 2 },
    { position: [-2.3, 0.2, -2.3], scale: 0.7, variant: 1 },
  ];
  const shrubs: V3[] = [
    [-1.6, 0.2, 2.6],
    [2.7, 0.2, 2.4],
    [-4.6, 0.2, -3.1],
    [4.9, 0.2, -3.0],
    [-5.9, 0.2, 5.6],
    [6.2, 0.2, 5.2],
    [1.2, 0.2, -3.6],
    [-2.8, 0.2, 1.1],
    [2.6, 0.2, -1.4],
  ];
  return (
    <group>
      {trees.map((tree, i) => (
        <Tree key={i} {...tree} />
      ))}
      {shrubs.map((position, i) => (
        <Shrub key={i} position={position} scale={0.8 + (i % 3) * 0.15} />
      ))}
      <Fence position={[-6.9, 0.2, 2.1]} rotation={0.5} length={2.4} />
      <Fence position={[6.6, 0.2, 3.9]} rotation={-0.4} length={2.4} />
      <Fence position={[3.4, 0.2, -3.4]} rotation={0.2} length={2.0} />
      <Lamp position={[-1.05, 0.2, -1.75]} />
      <Lamp position={[1.85, 0.2, 1.3]} />
      <Lamp position={[-2.35, 0.2, 2.3]} />
      <Bench position={[2.4, 0.2, 3.5]} rotation={-0.6} />
      <Bench position={[-3.9, 0.2, -2.3]} rotation={1.2} />
      {/* small garden beds */}
      {[
        [-1.1, 0.19, -3.4],
        [1.6, 0.19, 3.2],
      ].map((position, i) => (
        <group key={i} position={position as V3}>
          <mesh receiveShadow>
            <boxGeometry args={[1.1, 0.08, 0.6]} />
            <meshStandardMaterial color="#7a5a42" roughness={1} />
          </mesh>
          {[-0.35, 0, 0.35].map((x) => (
            <mesh key={x} position={[x, 0.12, 0]}>
              <sphereGeometry args={[0.12, 8, 6]} />
              <meshStandardMaterial color={["#c96a4a", "#e0b25a", "#d98aa0"][(i + Math.round(x * 3) + 3) % 3]} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

export default function DioramaTown({
  districts,
  muses,
  arrivals,
  rooms,
  focusedDistrict,
  featuredMuse,
  selectedMuse,
  claimTotal,
  questDistrictId,
  daypart,
  onSelectDistrict,
  onSelectMuse,
  onSelectRoom,
  onOpenInvitation,
}: TownProps) {
  const theme = THEMES[daypart];
  const positions = useRef(new Map<string, THREE.Vector3>());
  const islandPositions = useRef(new Map<string, THREE.Vector3>());
  const selectedRoomId = useMemo(() => {
    if (!selectedMuse) return null;
    const author = selectedMuse.muse_id || selectedMuse.name;
    return rooms.find((room) => room.members.some((m) => (m.muse_id || m.name) === author))?.id || null;
  }, [rooms, selectedMuse]);

  return (
    <ThemeContext.Provider value={theme}>
      <Exposure value={theme.exposure} />
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.fog, 26, 60]} />
      <ambientLight intensity={theme.ambient} />
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemiIntensity]} />
      <directionalLight
        position={theme.sunPosition}
        color={theme.sunColor}
        intensity={theme.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      <Terrain />
      <ContactShadows position={[0, -0.88, 0]} opacity={daypart === "night" ? 0.25 : 0.42} scale={30} blur={2.6} far={4} color="#3a2e22" />
      <Paths />
      <Pond />
      <Scenery />

      {districts.map((district) => {
        const layout = layoutFor(district);
        const active =
          focusedDistrict?.id === district.id ||
          selectedMuse?.district === district.id ||
          (!selectedMuse && featuredMuse?.district === district.id);
        return (
          <group key={district.id} position={layout.position}>
            <DistrictGround
              district={district}
              active={active}
              quest={questDistrictId === district.id}
              onSelect={onSelectDistrict}
            />
            <group rotation={[0, layout.rotation, 0]}>
              <DistrictBuilding district={district} claimTotal={claimTotal} />
            </group>
          </group>
        );
      })}

      <ArrivalsPier arrivals={arrivals} onOpen={onOpenInvitation} />

      <Islands
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelect={onSelectRoom}
        positions={islandPositions}
      />

      <Citizens
        muses={muses}
        districts={districts}
        selectedMuse={selectedMuse}
        featuredMuse={featuredMuse}
        onSelect={onSelectMuse}
        onPositions={(map) => {
          positions.current = map;
        }}
      />

      <CameraRig
        focus={focusedDistrict}
        selectedKey={selectedMuse ? museKey(selectedMuse) : null}
        positions={positions}
      />
      <Projector districts={districts} positions={positions} islands={islandPositions} />
    </ThemeContext.Provider>
  );
}
