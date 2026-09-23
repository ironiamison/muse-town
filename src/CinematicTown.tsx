import { useFrame, useThree } from "@react-three/fiber";
import {
  Float,
  RoundedBox,
  Stars,
  useGLTF,
} from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { Group, Mesh, ShaderMaterial } from "three";
import * as THREE from "three";
import {
  type MusePost,
  type MuseResident,
} from "./lib/musebook";

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

type WorldMuse = MusePost & {
  district: string;
  resident?: MuseResident;
};

type TownProps = {
  districts: District[];
  muses: WorldMuse[];
  arrivals: WorldMuse[];
  focusedDistrict: District | null;
  featuredMuse: WorldMuse | null;
  selectedMuse: WorldMuse | null;
  claimTotal: number;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: WorldMuse) => void;
  onOpenInvitation: () => void;
};

const palette = {
  ink: "#07101c",
  deep: "#0b1728",
  stone: "#59657a",
  pale: "#d6d9da",
  warm: "#ffbd73",
  cyan: "#65d6d2",
  window: "#ffc982",
};

function FrameBudget() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fps = reduced ? 4 : mobile ? 16 : 24;
    const timer = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [invalidate]);
  return null;
}

function HorizonDome() {
  return (
    <>
      <mesh scale={42}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={{
            uNight: { value: new THREE.Color("#020812") },
            uBlue: { value: new THREE.Color("#102b40") },
            uHorizon: { value: new THREE.Color("#61404a") },
          }}
          vertexShader={`
            varying float vHeight;
            varying vec3 vDirection;
            void main() {
              vec4 world = modelMatrix * vec4(position, 1.0);
              vDirection = normalize(world.xyz - cameraPosition);
              vHeight = normalize(position).y;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying float vHeight;
            varying vec3 vDirection;
            uniform vec3 uNight;
            uniform vec3 uBlue;
            uniform vec3 uHorizon;
            void main() {
              float horizonBand = exp(-pow((vHeight + .02) * 4.2, 2.0));
              float upper = smoothstep(-.08, .72, vHeight);
              vec3 sky = mix(uBlue, uNight, upper);
              sky = mix(sky, uHorizon, horizonBand * .38);
              gl_FragColor = vec4(sky, 1.0);
            }
          `}
        />
      </mesh>
    </>
  );
}

function AnimatedWater() {
  const material = useRef<ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[30, 96]} />
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        uniforms={{
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color("#071727") },
          uShallow: { value: new THREE.Color("#17445a") },
        }}
        vertexShader={`
          varying vec2 vUv;
          varying float vWave;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 p = position;
            float a = sin(p.x * .7 + uTime * .45) * .045;
            float b = cos(p.y * .55 - uTime * .32) * .035;
            p.z += a + b;
            vWave = a + b;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          varying float vWave;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform float uTime;
          void main() {
            float rings = sin((vUv.x + vUv.y) * 90.0 + uTime * .7) * .015;
            float glow = smoothstep(-.08, .08, vWave + rings);
            vec3 color = mix(uDeep, uShallow, glow);
            gl_FragColor = vec4(color, .96);
          }
        `}
      />
    </mesh>
  );
}

function Island() {
  return (
    <group>
      <mesh position={[0, -0.36, 0]} receiveShadow>
        <cylinderGeometry args={[8.45, 7.55, 0.78, 64]} />
        <meshStandardMaterial color="#273444" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[8.38, 8.38, 0.12, 64]} />
        <meshStandardMaterial color="#18313a" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.095, 0]} receiveShadow>
        <cylinderGeometry args={[7.95, 7.95, 0.08, 64]} />
        <meshStandardMaterial color="#213b3d" roughness={0.96} />
      </mesh>
      {Array.from({ length: 30 }, (_, index) => {
        const angle = (index / 30) * Math.PI * 2;
        const radius = 8.1 + Math.sin(index * 2.31) * 0.18;
        const scale = 0.22 + (index % 4) * 0.045;
        return (
          <mesh
            key={index}
            position={[
              Math.cos(angle) * radius,
              -0.05 - (index % 3) * 0.06,
              Math.sin(angle) * radius,
            ]}
            rotation={[index * 0.13, angle, index * 0.07]}
            scale={[scale * 1.4, scale, scale]}
          >
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={index % 3 ? "#42505b" : "#53606a"} roughness={1} />
          </mesh>
        );
      })}
    </group>
  );
}

function AuthoredBuilding({
  path,
  position,
  rotation = 0,
  height,
}: {
  path: string;
  position: [number, number, number];
  rotation?: number;
  height: number;
}) {
  const { scene } = useGLTF(path);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    return {
      object: clone,
      scale: height / Math.max(size.y, 0.001),
      offset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
    };
  }, [scene, height]);

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={model.scale}>
      <primitive object={model.object} position={model.offset} />
    </group>
  );
}

function AuthoredSkyline() {
  return (
    <group>
      <AuthoredBuilding
        path="/models/kenney-city/building-e-embedded.glb"
        position={[-6.1, 0.15, -3.8]}
        rotation={Math.PI * 0.28}
        height={2.05}
      />
      <AuthoredBuilding
        path="/models/kenney-city/building-i-embedded.glb"
        position={[-3.3, 0.15, -6.0]}
        rotation={Math.PI * 0.12}
        height={2.3}
      />
      <AuthoredBuilding
        path="/models/kenney-city/building-j-embedded.glb"
        position={[0, 0.15, -6.55]}
        rotation={0}
        height={2.15}
      />
      <AuthoredBuilding
        path="/models/kenney-city/building-k-embedded.glb"
        position={[3.25, 0.15, -6.0]}
        rotation={-Math.PI * 0.12}
        height={1.95}
      />
      <AuthoredBuilding
        path="/models/kenney-city/building-n-embedded.glb"
        position={[6.05, 0.15, -3.75]}
        rotation={-Math.PI * 0.28}
        height={2.35}
      />
      <AuthoredBuilding
        path="/models/kenney-city/building-skyscraper-a-embedded.glb"
        position={[-6.7, 0.15, -0.2]}
        rotation={Math.PI / 2}
        height={2.8}
      />
    </group>
  );
}

function Road({
  points,
  color = "#718185",
}: {
  points: [number, number, number][];
  color?: string;
}) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "catmullrom",
      0.25,
    );
    return new THREE.TubeGeometry(curve, 48, 0.28, 8, false);
  }, [points]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.82} metalness={0.06} />
    </mesh>
  );
}

function DistrictRoads({ districts }: { districts: District[] }) {
  return (
    <group>
      {districts.slice(1).map((district, index) => (
        <Road
          key={district.id}
          points={[
            [0, 0.22, 0],
            [
              district.position[0] * 0.48 + (index % 2 ? 0.3 : -0.3),
              0.22,
              district.position[2] * 0.42,
            ],
            [district.position[0], 0.22, district.position[2]],
          ]}
        />
      ))}
      <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[1.45, 1.78, 64]} />
        <meshStandardMaterial color="#7d8b8d" roughness={0.84} />
      </mesh>
    </group>
  );
}

function Window({
  position,
  scale = [0.28, 0.42, 0.03],
  color = palette.window,
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={scale} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Lantern({ position, color = palette.window }: { position: [number, number, number]; color?: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.025, 0.032, 0.7, 8]} />
        <meshStandardMaterial color="#1b2732" metalness={0.55} roughness={0.44} />
      </mesh>
      <mesh position={[0, 0.76, 0]}>
        <sphereGeometry args={[0.095, 12, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 0.76, 0]} color={color} intensity={2.4} distance={2.7} />
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.13, 0.96, 9]} />
        <meshStandardMaterial color="#43352e" roughness={1} />
      </mesh>
      {[
        [0, 1.13, 0, 0.52],
        [-0.31, 1.04, 0.06, 0.36],
        [0.28, 1.2, -0.05, 0.4],
        [0.03, 1.48, 0.02, 0.34],
      ].map(([x, y, z, size], index) => (
        <mesh key={index} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[size, 1]} />
          <meshStandardMaterial
            color={index % 2 ? "#2f6257" : "#3d7768"}
            roughness={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

function CommonBuilding({ color }: { color: string }) {
  const crown = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (crown.current) crown.current.rotation.y = clock.elapsedTime * 0.08;
  });
  return (
    <group>
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <cylinderGeometry args={[1.55, 1.72, 0.34, 32]} />
        <meshStandardMaterial color="#738087" roughness={0.8} />
      </mesh>
      {Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 1.18, 0.95, Math.sin(angle) * 1.18]}
            castShadow
          >
            <cylinderGeometry args={[0.065, 0.085, 1.55, 10]} />
            <meshStandardMaterial color="#c6c8c2" roughness={0.72} />
          </mesh>
        );
      })}
      <mesh position={[0, 1.78, 0]} castShadow>
        <cylinderGeometry args={[0.34, 1.58, 0.54, 32]} />
        <meshStandardMaterial color="#1d3a48" metalness={0.25} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1.45, 10]} />
        <meshStandardMaterial color="#694936" roughness={0.8} />
      </mesh>
      <group ref={crown} position={[0, 1.35, 0]}>
        {Array.from({ length: 9 }, (_, index) => {
          const angle = (index / 9) * Math.PI * 2;
          return (
            <Float key={index} speed={1.1 + index * 0.03} floatIntensity={0.12}>
              <mesh position={[Math.cos(angle) * 0.48, (index % 3) * 0.18, Math.sin(angle) * 0.48]}>
                <octahedronGeometry args={[0.11, 0]} />
                <meshStandardMaterial
                  color={index % 2 ? color : palette.cyan}
                  emissive={index % 2 ? color : palette.cyan}
                  emissiveIntensity={3}
                  toneMapped={false}
                />
              </mesh>
            </Float>
          );
        })}
      </group>
      <pointLight position={[0, 1.4, 0]} color={color} intensity={5} distance={4} />
    </group>
  );
}

function WorkshopBuilding({ color }: { color: string }) {
  const gear = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (gear.current) gear.current.rotation.z += delta * 0.28;
  });
  return (
    <group>
      <RoundedBox position={[0, 0.75, 0]} args={[2.8, 1.5, 1.8]} radius={0.08} smoothness={3} castShadow>
        <meshStandardMaterial color="#344353" roughness={0.76} />
      </RoundedBox>
      {[-0.86, 0, 0.86].map((x) => (
        <mesh key={x} position={[x, 1.7, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[0.88, 0.88, 1.88]} />
          <meshStandardMaterial color="#203447" roughness={0.65} metalness={0.18} />
        </mesh>
      ))}
      {[-0.78, 0, 0.78].map((x) => (
        <Window key={x} position={[x, 0.86, 0.92]} scale={[0.48, 0.62, 0.035]} color="#67d8d2" />
      ))}
      <mesh position={[1.03, 2.2, -0.4]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.7, 12]} />
        <meshStandardMaterial color="#26323a" metalness={0.42} roughness={0.52} />
      </mesh>
      <group position={[-1.41, 0.92, 0.93]}>
        <mesh ref={gear} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.34, 0.08, 8, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
        </mesh>
      </group>
      <pointLight position={[0, 1.1, 1.15]} color="#5ed6d1" intensity={4} distance={4} />
    </group>
  );
}

function MarketBuilding({ color, claimTotal }: { color: string; claimTotal: number }) {
  return (
    <group>
      {[-0.94, 0, 0.94].map((x, index) => (
        <group key={x} position={[x, 0, 0]}>
          <RoundedBox position={[0, 0.65, 0]} args={[0.85, 1.3, 1.5]} radius={0.07} smoothness={3} castShadow>
            <meshStandardMaterial color={index === 1 ? "#4c4152" : "#3e3b4b"} roughness={0.78} />
          </RoundedBox>
          <mesh position={[0, 1.46, 0.2]} rotation={[0.08, 0, 0]} castShadow>
            <boxGeometry args={[1, 0.12, 1.05]} />
            <meshStandardMaterial color={index % 2 ? "#d9b46c" : color} roughness={0.63} />
          </mesh>
          <Window position={[0, 0.74, 0.76]} scale={[0.54, 0.5, 0.035]} />
          <Lantern position={[-0.31, 0.42, 0.86]} color="#ffd17d" />
          <Lantern position={[0.31, 0.42, 0.86]} color="#ffd17d" />
        </group>
      ))}
      <group position={[0, 2.05, 0]}>
        <mesh>
          <boxGeometry args={[1.32, 0.52, 0.1]} />
          <meshStandardMaterial color="#111d29" metalness={0.3} roughness={0.48} />
        </mesh>
        {[0, 1, 2, 3].map((index) => {
          const level = 0.08 + Math.min(0.28, (claimTotal / 100 + index * 0.07) % 0.31);
          return (
            <mesh key={index} position={[-0.45 + index * 0.3, -0.18 + level / 2, 0.065]}>
              <boxGeometry args={[0.18, level, 0.025]} />
              <meshStandardMaterial
                color={index % 2 ? "#ffbd73" : "#65d6d2"}
                emissive={index % 2 ? "#ffbd73" : "#65d6d2"}
                emissiveIntensity={1.8}
                toneMapped={false}
              />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function AssemblyBuilding({ color }: { color: string }) {
  return (
    <group>
      {[0, 0.16, 0.32].map((y, index) => (
        <mesh key={y} position={[0, y + 0.08, 0.18 + index * 0.12]} receiveShadow>
          <boxGeometry args={[3.2 - index * 0.24, 0.16, 2.15 - index * 0.12]} />
          <meshStandardMaterial color={index % 2 ? "#66717c" : "#7a838a"} roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[2.75, 1.55, 1.65]} />
        <meshStandardMaterial color="#525f6c" roughness={0.76} />
      </mesh>
      {[-1, -0.6, -0.2, 0.2, 0.6, 1].map((x) => (
        <mesh key={x} position={[x, 1.1, 0.94]} castShadow>
          <cylinderGeometry args={[0.075, 0.1, 1.45, 12]} />
          <meshStandardMaterial color="#bfc4c4" roughness={0.67} />
        </mesh>
      ))}
      <mesh position={[0, 1.93, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.85, 0.82, 4]} />
        <meshStandardMaterial color={color} metalness={0.16} roughness={0.61} />
      </mesh>
      <mesh position={[0, 2.54, 0]}>
        <sphereGeometry args={[0.38, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c89d59" metalness={0.4} roughness={0.43} />
      </mesh>
      <Window position={[0, 1.08, 0.84]} scale={[0.34, 0.58, 0.035]} color="#ffd18a" />
      <pointLight position={[0, 1.2, 1.2]} color="#ffd18a" intensity={3.2} distance={4} />
    </group>
  );
}

function SchoolBuilding({ color }: { color: string }) {
  return (
    <group>
      <RoundedBox position={[0, 0.85, 0]} args={[2.75, 1.7, 1.65]} radius={0.08} smoothness={3} castShadow>
        <meshStandardMaterial color="#36463f" roughness={0.77} />
      </RoundedBox>
      <mesh position={[0, 1.92, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.85, 0.92, 4]} />
        <meshPhysicalMaterial
          color="#58766c"
          transparent
          opacity={0.82}
          transmission={0.18}
          roughness={0.24}
          metalness={0.08}
        />
      </mesh>
      {[-0.9, -0.3, 0.3, 0.9].map((x, index) => (
        <Window
          key={x}
          position={[x, 0.92, 0.84]}
          scale={[0.35, 0.67, 0.035]}
          color={index % 2 ? "#89e0ba" : "#f4cb82"}
        />
      ))}
      <mesh position={[1.12, 2.45, -0.22]} castShadow>
        <cylinderGeometry args={[0.18, 0.25, 1.5, 8]} />
        <meshStandardMaterial color={color} roughness={0.62} />
      </mesh>
      <mesh position={[1.12, 3.1, -0.22]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.4, 0.48, 4]} />
        <meshStandardMaterial color="#9cae78" roughness={0.72} />
      </mesh>
      <pointLight position={[0, 1.1, 1]} color="#92e5c2" intensity={3.5} distance={4} />
    </group>
  );
}

function DistrictBuilding({
  district,
  claimTotal,
}: {
  district: District;
  claimTotal: number;
}) {
  if (district.kind === "porch") return <CommonBuilding color={district.color} />;
  if (district.kind === "workshop") return <WorkshopBuilding color={district.color} />;
  if (district.kind === "market") return <MarketBuilding color={district.color} claimTotal={claimTotal} />;
  if (district.kind === "hall") return <AssemblyBuilding color={district.color} />;
  return <SchoolBuilding color={district.color} />;
}

function MuseCitizen({
  muse,
  index,
  district,
  featured,
  selected,
  onSelect,
}: {
  muse: WorldMuse;
  index: number;
  district: District;
  featured: boolean;
  selected: boolean;
  onSelect: (muse: WorldMuse) => void;
}) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const angle = (index / 6) * Math.PI * 2 + (muse.name.length % 5) * 0.33;
  const radius = 1.72 + (index % 2) * 0.24;
  const base = useMemo(
    () => new THREE.Vector3(Math.cos(angle) * radius, 0.21, Math.sin(angle) * radius),
    [angle, radius],
  );
  const identityColor = useMemo(() => {
    let hash = 0;
    for (const character of muse.name) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return new THREE.Color().setHSL((hash % 360) / 360, 0.55, 0.58);
  }, [muse.name]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const t = clock.elapsedTime * (0.11 + (index % 3) * 0.016) + angle;
    group.current.position.x = base.x + Math.cos(t) * 0.16;
    group.current.position.z = base.z + Math.sin(t) * 0.16;
    group.current.position.y = base.y + Math.abs(Math.sin(clock.elapsedTime * 2 + index)) * 0.025;
    group.current.rotation.y = -t + Math.PI / 2;
    if (ring.current) ring.current.rotation.z += delta * 0.8;
  });

  return (
    <group
      ref={group}
      position={base}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(muse);
      }}
      onPointerEnter={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
      }}
    >
      <mesh position={[0, 0.36, 0]} castShadow>
        <capsuleGeometry args={[0.13, 0.38, 6, 12]} />
        <meshStandardMaterial
          color={district.color}
          emissive={district.color}
          emissiveIntensity={featured ? 0.7 : 0.06}
          roughness={0.62}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0, 0.57, 0.115]}>
        <sphereGeometry args={[0.08, 14, 10]} />
        <meshStandardMaterial color="#9ee7dc" emissive="#65d6d2" emissiveIntensity={1.2} />
      </mesh>
      <RoundedBox
        position={[0, 0.84, 0]}
        args={[0.36, 0.34, 0.26]}
        radius={0.075}
        smoothness={3}
        castShadow
      >
        <meshStandardMaterial
          color={identityColor}
          emissive={identityColor}
          emissiveIntensity={featured ? 0.55 : 0.08}
          roughness={0.58}
          metalness={0.1}
        />
      </RoundedBox>
      <mesh position={[0, 0.84, 0.139]}>
        <boxGeometry args={[0.23, 0.18, 0.018]} />
        <meshStandardMaterial
          color="#07131f"
          emissive={featured ? "#ffbd73" : "#65d6d2"}
          emissiveIntensity={featured ? 1.4 : 0.42}
        />
      </mesh>
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 0.865, 0.151]}>
          <sphereGeometry args={[0.018, 8, 6]} />
          <meshBasicMaterial color={featured ? "#fff0c9" : "#b7fff3"} toneMapped={false} />
        </mesh>
      ))}
      {(featured || selected) && (
        <>
          <mesh ref={ring} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.31, 0.022, 6, 32]} />
            <meshBasicMaterial color={featured ? palette.warm : palette.cyan} toneMapped={false} />
          </mesh>
          <pointLight position={[0, 0.7, 0]} color={featured ? palette.warm : palette.cyan} intensity={2.8} distance={2.2} />
        </>
      )}
    </group>
  );
}

function DistrictQuarter({
  district,
  muses,
  featuredMuse,
  selectedMuse,
  claimTotal,
  onSelectDistrict,
  onSelectMuse,
}: {
  district: District;
  muses: WorldMuse[];
  featuredMuse: WorldMuse | null;
  selectedMuse: WorldMuse | null;
  claimTotal: number;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: WorldMuse) => void;
}) {
  const active =
    featuredMuse?.district === district.id ||
    selectedMuse?.district === district.id;
  return (
    <group position={district.position}>
      <mesh
        position={[0, 0.16, 0]}
        receiveShadow
        onClick={() => onSelectDistrict(district.id)}
      >
        <cylinderGeometry args={[2.35, 2.48, 0.25, 48]} />
        <meshStandardMaterial
          color={active ? "#35505a" : "#293f47"}
          roughness={0.87}
          metalness={0.06}
        />
      </mesh>
      <mesh position={[0, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.14, 2.23, 64]} />
        <meshStandardMaterial
          color={district.color}
          emissive={district.color}
          emissiveIntensity={active ? 1.6 : 0.3}
          toneMapped={false}
        />
      </mesh>
      <DistrictBuilding district={district} claimTotal={claimTotal} />
      {muses.slice(0, 4).map((muse, index) => (
        <MuseCitizen
          key={`${district.id}-${muse.muse_id || muse.name}-${muse.id}`}
          muse={muse}
          index={index}
          district={district}
          featured={
            featuredMuse?.id === muse.id &&
            featuredMuse.district === muse.district
          }
          selected={
            selectedMuse?.id === muse.id &&
            selectedMuse.district === muse.district
          }
          onSelect={onSelectMuse}
        />
      ))}
      <group
        position={[-1.72, 0.78, 1.58]}
        onClick={(event) => {
          event.stopPropagation();
          onSelectDistrict(district.id);
        }}
      >
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.025, 0.035, 0.92, 8]} />
          <meshStandardMaterial color="#9aa6a7" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.22, 0.7, 0]}>
          <boxGeometry args={[0.43, 0.24, 0.035]} />
          <meshStandardMaterial
            color={district.color}
            emissive={district.color}
            emissiveIntensity={active ? 1.6 : 0.35}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function ArrivalPier({
  arrivals,
  onOpen,
}: {
  arrivals: WorldMuse[];
  onOpen: () => void;
}) {
  return (
    <group position={[0, 0.08, 6.65]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[2.4, 0.18, 2.7]} />
        <meshStandardMaterial color="#4a5862" roughness={0.75} />
      </mesh>
      {[-0.96, -0.48, 0, 0.48, 0.96].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]}>
          <boxGeometry args={[0.035, 0.025, 2.45]} />
          <meshStandardMaterial color="#7d8790" />
        </mesh>
      ))}
      {[-0.95, 0.95].map((x) => (
        <Lantern key={x} position={[x, 0.08, -0.75]} color="#ffb96b" />
      ))}
      <group
        position={[0, 1.18, -0.86]}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        onPointerEnter={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          document.body.style.cursor = "default";
        }}
      >
        <mesh>
          <boxGeometry args={[1.65, 0.55, 0.11]} />
          <meshStandardMaterial color="#112433" metalness={0.28} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <boxGeometry args={[1.42, 0.32, 0.025]} />
          <meshStandardMaterial
            color="#163c48"
            emissive="#65d6d2"
            emissiveIntensity={arrivals.length ? 1.25 : 0.58}
            toneMapped={false}
          />
        </mesh>
        {Array.from({ length: Math.min(5, Math.max(1, arrivals.length)) }, (_, index) => (
          <mesh key={index} position={[-0.44 + index * 0.22, 0, 0.084]}>
            <circleGeometry args={[0.04, 12]} />
            <meshBasicMaterial color={arrivals.length ? "#d5fff5" : "#74a9a5"} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function AmbientLife() {
  const ferry = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ferry.current) {
      const t = clock.elapsedTime * 0.07;
      ferry.current.position.x = Math.sin(t) * 12;
      ferry.current.position.z = 10 + Math.cos(t) * 2.1;
      ferry.current.rotation.y = -Math.cos(t) * 0.18;
    }
  });
  return (
    <group ref={ferry} position={[0, -0.28, 10]}>
      <mesh>
        <boxGeometry args={[1.6, 0.22, 0.6]} />
        <meshStandardMaterial color="#273a49" metalness={0.15} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.86, 0.42, 0.46]} />
        <meshStandardMaterial color="#c4c8c6" roughness={0.63} />
      </mesh>
      <pointLight position={[-0.72, 0.1, 0.3]} color="#ffbb6c" intensity={2} distance={2} />
      <pointLight position={[0.72, 0.1, 0.3]} color="#ffbb6c" intensity={2} distance={2} />
    </group>
  );
}

function CameraDirector({
  focus,
}: {
  focus: District | null;
}) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.8, 0));
  const lastFocus = useRef<string | null>(null);
  useFrame(({ clock }) => {
    const focusChanged = lastFocus.current !== (focus?.id || null);
    if (focusChanged) lastFocus.current = focus?.id || null;
    const drift = focus ? 0.12 : 0.32;
    const target = focus
      ? new THREE.Vector3(focus.position[0], 0.95, focus.position[2])
      : new THREE.Vector3(0, 0.7, 0);
    const desired = focus
      ? new THREE.Vector3(
          focus.position[0] + 6.2 + Math.sin(clock.elapsedTime * 0.05) * drift,
          5.3,
          focus.position[2] + 7.1,
        )
      : new THREE.Vector3(
          11.5 + Math.sin(clock.elapsedTime * 0.035) * drift,
          8.4,
          13.5,
        );
    camera.position.lerp(desired, focusChanged ? 0.08 : 0.025);
    look.current.lerp(target, 0.035);
    camera.lookAt(look.current);
  });
  return null;
}

export default function CinematicTown({
  districts,
  muses,
  arrivals,
  focusedDistrict,
  featuredMuse,
  selectedMuse,
  claimTotal,
  onSelectDistrict,
  onSelectMuse,
  onOpenInvitation,
}: TownProps) {
  return (
    <>
      <FrameBudget />
      <color attach="background" args={[palette.ink]} />
      <fog attach="fog" args={["#081522", 16, 39]} />
      <HorizonDome />
      <Stars radius={65} depth={32} count={900} factor={1.4} saturation={0.2} fade speed={0.08} />
      <hemisphereLight args={["#779dc3", "#07101c", 1.45]} />
      <directionalLight
        position={[-7, 10, -6]}
        color="#ffd1a0"
        intensity={3.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <pointLight position={[0, 7, 2]} color="#4d8fba" intensity={4} distance={18} />
      <AnimatedWater />
      <Island />
      <Suspense fallback={null}>
        <AuthoredSkyline />
      </Suspense>
      <DistrictRoads districts={districts} />

      {[
        [-6.4, 0.15, -3.8],
        [-6.7, 0.15, 2.3],
        [-1.7, 0.15, 5.9],
        [1.2, 0.15, 6.2],
        [6.4, 0.15, 3.6],
        [6.7, 0.15, -3.1],
        [-1.7, 0.15, -5.8],
        [2.7, 0.15, -5.65],
      ].map((position, index) => (
        <Tree
          key={index}
          position={position as [number, number, number]}
          scale={0.86 + (index % 3) * 0.14}
        />
      ))}
      {[
        [-1.6, 0.18, -0.95],
        [1.6, 0.18, 0.95],
        [-2.4, 0.18, 1.4],
        [2.4, 0.18, -1.4],
      ].map((position, index) => (
        <Lantern key={index} position={position as [number, number, number]} />
      ))}

      {districts.map((district) => (
        <DistrictQuarter
          key={district.id}
          district={district}
          muses={muses.filter((muse) => muse.district === district.id)}
          featuredMuse={featuredMuse}
          selectedMuse={selectedMuse}
          claimTotal={claimTotal}
          onSelectDistrict={onSelectDistrict}
          onSelectMuse={onSelectMuse}
        />
      ))}
      <ArrivalPier
        arrivals={arrivals}
        onOpen={onOpenInvitation}
      />
      <AmbientLife />
      <CameraDirector focus={focusedDistrict} />
    </>
  );
}

[
  "building-e",
  "building-i",
  "building-j",
  "building-k",
  "building-n",
  "building-skyscraper-a",
].forEach((name) => useGLTF.preload(`/models/kenney-city/${name}-embedded.glb`));
