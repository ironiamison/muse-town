import { Minus, Plus, Scan } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MusePost, MuseResident } from "./lib/musebook";

export type IsoDistrictKind =
  | "porch"
  | "workshop"
  | "market"
  | "hall"
  | "school";

export type IsoDistrict = {
  id: string;
  name: string;
  verb: string;
  description: string;
  color: string;
  kind: IsoDistrictKind;
  tile: [number, number];
};

export type IsoMuse = MusePost & {
  district: string;
  resident?: MuseResident;
};

type IsometricTownProps = {
  districts: IsoDistrict[];
  muses: IsoMuse[];
  focusedDistrict: IsoDistrict | null;
  featuredMuse: IsoMuse | null;
  selectedMuse: IsoMuse | null;
  questDistrictId: string | null;
  claimTotal: number;
  onSelectDistrict: (id: string) => void;
  onSelectMuse: (muse: IsoMuse) => void;
};

type CameraState = {
  zoom: number;
  targetZoom: number;
  panX: number;
  panY: number;
  targetPanX: number;
  targetPanY: number;
  manual: boolean;
};

type HitTarget =
  | { type: "district"; id: string; x: number; y: number; radius: number }
  | { type: "muse"; muse: IsoMuse; x: number; y: number; radius: number };

type Point = { x: number; y: number };

const MAP_WIDTH = 25;
const MAP_HEIGHT = 19;
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const HALF_TILE_WIDTH = TILE_WIDTH / 2;
const HALF_TILE_HEIGHT = TILE_HEIGHT / 2;
const WORLD_CENTER: [number, number] = [12, 9];

const sceneryTrees: [number, number, number][] = [
  [1.2, 1.6, 1],
  [3.1, 2.3, 0.8],
  [7.8, 1.2, 1.05],
  [10.2, 2.2, 0.78],
  [14.8, 1.5, 0.95],
  [21.5, 1.4, 1.08],
  [23, 3.2, 0.82],
  [2.1, 7.1, 0.9],
  [3.6, 11.8, 1.08],
  [1.5, 16.7, 0.88],
  [9.1, 16.3, 0.82],
  [14.1, 16.9, 1.02],
  [21.8, 16.2, 0.9],
  [23.1, 12.1, 1.08],
  [20.8, 8.1, 0.78],
  [9.3, 7.1, 0.72],
  [15.4, 11.9, 0.72],
];

const rockPositions: [number, number][] = [
  [4.2, 1.1],
  [8.6, 3.1],
  [17.2, 2.4],
  [22.4, 6.4],
  [1.8, 10.8],
  [4.8, 16.4],
  [11.1, 17.2],
  [20.8, 17.1],
  [23.2, 14.8],
  [16.4, 16.1],
];

function hashText(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function identityColor(value: string) {
  const colors = [
    "#ef7f62",
    "#60c9c2",
    "#f1bd58",
    "#9a86de",
    "#70b97b",
    "#dc759e",
    "#5f9fd7",
    "#d59058",
  ];
  return colors[hashText(value) % colors.length];
}

function shade(hex: string, amount: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(
    clean.length === 3
      ? clean
          .split("")
          .map((character) => character + character)
          .join("")
      : clean,
    16,
  );
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, ((value >> shift) & 255) + amount));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function polygon(
  context: CanvasRenderingContext2D,
  points: Point[],
  fill: string,
  stroke?: string,
  lineWidth = 1,
) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
  }
}

function isoPoint(
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  camera: CameraState,
) {
  const relativeX = worldX - WORLD_CENTER[0];
  const relativeY = worldY - WORLD_CENTER[1];
  return {
    x:
      width / 2 +
      (relativeX - relativeY) * HALF_TILE_WIDTH * camera.zoom +
      camera.panX,
    y:
      height * 0.47 +
      (relativeX + relativeY) * HALF_TILE_HEIGHT * camera.zoom +
      camera.panY,
  };
}

function drawDiamond(
  context: CanvasRenderingContext2D,
  center: Point,
  zoom: number,
  fill: string,
  stroke: string,
) {
  polygon(
    context,
    [
      { x: center.x, y: center.y - HALF_TILE_HEIGHT * zoom },
      { x: center.x + HALF_TILE_WIDTH * zoom, y: center.y },
      { x: center.x, y: center.y + HALF_TILE_HEIGHT * zoom },
      { x: center.x - HALF_TILE_WIDTH * zoom, y: center.y },
    ],
    fill,
    stroke,
    Math.max(0.45, zoom * 0.7),
  );
}

function isRoadTile(x: number, y: number) {
  const plaza = x >= 10 && x <= 14 && y >= 7 && y <= 11;
  const spine = x === 12 || y === 9;
  const upper = y === 5 && x >= 5 && x <= 19;
  const lower = y === 14 && x >= 5 && x <= 19;
  const left = x === 6 && y >= 5 && y <= 14;
  const right = x === 18 && y >= 5 && y <= 14;
  return plaza || spine || upper || lower || left || right;
}

function isPlazaTile(x: number, y: number) {
  return x >= 10 && x <= 14 && y >= 7 && y <= 11;
}

function drawIsoBlock(
  context: CanvasRenderingContext2D,
  center: Point,
  zoom: number,
  size: number,
  height: number,
  color: string,
) {
  const halfWidth = HALF_TILE_WIDTH * size * zoom;
  const halfHeight = HALF_TILE_HEIGHT * size * zoom;
  const rise = height * zoom;
  const top = [
    { x: center.x, y: center.y - halfHeight - rise },
    { x: center.x + halfWidth, y: center.y - rise },
    { x: center.x, y: center.y + halfHeight - rise },
    { x: center.x - halfWidth, y: center.y - rise },
  ];
  polygon(
    context,
    [top[3], top[2], { x: center.x, y: center.y + halfHeight }, { x: center.x - halfWidth, y: center.y }],
    shade(color, -28),
    "rgba(9,18,24,.55)",
    1.2 * zoom,
  );
  polygon(
    context,
    [top[2], top[1], { x: center.x + halfWidth, y: center.y }, { x: center.x, y: center.y + halfHeight }],
    shade(color, -48),
    "rgba(9,18,24,.55)",
    1.2 * zoom,
  );
  polygon(context, top, color, "rgba(8,16,22,.65)", 1.2 * zoom);
  return { top, halfWidth, halfHeight, rise };
}

function drawWindow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  glow = "#ffe38e",
) {
  context.fillStyle = "rgba(3,11,15,.78)";
  context.fillRect(x - 5 * zoom, y - 7 * zoom, 10 * zoom, 13 * zoom);
  context.fillStyle = glow;
  context.fillRect(x - 3.6 * zoom, y - 5.5 * zoom, 7.2 * zoom, 9.5 * zoom);
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  district: IsoDistrict,
  point: Point,
  zoom: number,
  time: number,
  claimTotal: number,
) {
  const outline = "rgba(5,14,20,.7)";
  if (district.kind === "porch") {
    const fountainY = point.y - 2 * zoom;
    context.fillStyle = "rgba(5,18,24,.18)";
    context.beginPath();
    context.ellipse(
      point.x,
      fountainY + 14 * zoom,
      52 * zoom,
      24 * zoom,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillStyle = "#9aa9ae";
    context.beginPath();
    context.ellipse(point.x, fountainY, 46 * zoom, 23 * zoom, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#4bb7db";
    context.beginPath();
    context.ellipse(point.x, fountainY - 2 * zoom, 38 * zoom, 18 * zoom, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(210,244,255,.5)";
    context.lineWidth = 1.4 * zoom;
    context.stroke();
    context.fillStyle = "#77868d";
    context.fillRect(point.x - 5 * zoom, fountainY - 35 * zoom, 10 * zoom, 34 * zoom);
    context.fillStyle = "#b8c4c5";
    context.beginPath();
    context.ellipse(
      point.x,
      fountainY - 35 * zoom,
      14 * zoom,
      7 * zoom,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    const spray = Math.sin(time * 0.004) * 3 * zoom;
    context.strokeStyle = "#baf0ff";
    context.lineWidth = 2 * zoom;
    context.beginPath();
    context.moveTo(point.x, fountainY - 39 * zoom);
    context.quadraticCurveTo(
      point.x - 17 * zoom,
      fountainY - 61 * zoom - spray,
      point.x - 25 * zoom,
      fountainY - 37 * zoom,
    );
    context.moveTo(point.x, fountainY - 39 * zoom);
    context.quadraticCurveTo(
      point.x + 17 * zoom,
      fountainY - 61 * zoom + spray,
      point.x + 25 * zoom,
      fountainY - 37 * zoom,
    );
    context.stroke();
    return;
  }

  const size = district.kind === "market" ? 1.65 : 2;
  const rise = district.kind === "hall" ? 72 : 58;
  const block = drawIsoBlock(
    context,
    point,
    zoom,
    size,
    rise,
    district.kind === "school" ? "#d8d4ba" : "#d7c9aa",
  );
  const roofY = point.y - block.rise - block.halfHeight;
  const roofColor = district.color;

  if (district.kind === "workshop") {
    polygon(
      context,
      [
        { x: point.x, y: roofY - 34 * zoom },
        { x: point.x + block.halfWidth + 8 * zoom, y: roofY + block.halfHeight * 0.8 },
        { x: point.x, y: roofY + block.halfHeight * 1.62 },
        { x: point.x - block.halfWidth - 8 * zoom, y: roofY + block.halfHeight * 0.8 },
      ],
      roofColor,
      outline,
      1.3 * zoom,
    );
    context.fillStyle = "#34434a";
    context.fillRect(
      point.x + 30 * zoom,
      roofY - 28 * zoom,
      14 * zoom,
      44 * zoom,
    );
    context.fillStyle = "#202e34";
    context.fillRect(
      point.x + 27 * zoom,
      roofY - 32 * zoom,
      20 * zoom,
      7 * zoom,
    );
  } else if (district.kind === "market") {
    polygon(
      context,
      [
        { x: point.x, y: roofY - 18 * zoom },
        { x: point.x + block.halfWidth + 4 * zoom, y: roofY + block.halfHeight },
        { x: point.x, y: roofY + block.halfHeight * 1.65 },
        { x: point.x - block.halfWidth - 4 * zoom, y: roofY + block.halfHeight },
      ],
      "#f1d37b",
      outline,
      1.3 * zoom,
    );
    [-1, 0, 1].forEach((index) => {
      context.fillStyle = index % 2 ? "#f5e0a4" : roofColor;
      context.fillRect(
        point.x - 42 * zoom + (index + 1) * 29 * zoom,
        point.y - 21 * zoom,
        23 * zoom,
        7 * zoom,
      );
    });
    context.fillStyle = "#162732";
    context.fillRect(point.x - 34 * zoom, roofY - 43 * zoom, 68 * zoom, 22 * zoom);
    context.fillStyle = "#ffd374";
    context.font = `700 ${Math.max(7, 8 * zoom)}px ui-monospace`;
    context.textAlign = "center";
    context.fillText(
      claimTotal > 0 ? `$${Math.round(claimTotal)}+ CLAIMS` : "MARKET BOARD",
      point.x,
      roofY - 28 * zoom,
    );
  } else if (district.kind === "hall") {
    polygon(
      context,
      [
        { x: point.x, y: roofY - 42 * zoom },
        { x: point.x + block.halfWidth + 10 * zoom, y: roofY + block.halfHeight },
        { x: point.x, y: roofY + block.halfHeight * 1.8 },
        { x: point.x - block.halfWidth - 10 * zoom, y: roofY + block.halfHeight },
      ],
      roofColor,
      outline,
      1.3 * zoom,
    );
    context.fillStyle = "#e0b867";
    context.beginPath();
    context.arc(point.x, roofY - 42 * zoom, 8 * zoom, 0, Math.PI * 2);
    context.fill();
  } else {
    polygon(
      context,
      [
        { x: point.x, y: roofY - 32 * zoom },
        { x: point.x + block.halfWidth + 6 * zoom, y: roofY + block.halfHeight },
        { x: point.x, y: roofY + block.halfHeight * 1.72 },
        { x: point.x - block.halfWidth - 6 * zoom, y: roofY + block.halfHeight },
      ],
      roofColor,
      outline,
      1.3 * zoom,
    );
    context.fillStyle = "#e9ddb5";
    context.fillRect(point.x + 38 * zoom, roofY - 60 * zoom, 8 * zoom, 38 * zoom);
    context.fillStyle = district.color;
    context.beginPath();
    context.moveTo(point.x + 46 * zoom, roofY - 60 * zoom);
    context.lineTo(point.x + 67 * zoom, roofY - 51 * zoom);
    context.lineTo(point.x + 46 * zoom, roofY - 43 * zoom);
    context.closePath();
    context.fill();
  }

  drawWindow(context, point.x - 31 * zoom, point.y - 35 * zoom, zoom);
  drawWindow(context, point.x, point.y - 21 * zoom, zoom);
  drawWindow(
    context,
    point.x + 31 * zoom,
    point.y - 35 * zoom,
    zoom,
    district.kind === "school" ? "#9cf2cd" : "#ffe38e",
  );
}

function drawTree(
  context: CanvasRenderingContext2D,
  point: Point,
  zoom: number,
  size = 1,
) {
  const scale = zoom * size;
  context.fillStyle = "rgba(11,29,23,.18)";
  context.beginPath();
  context.ellipse(
    point.x + 10 * scale,
    point.y + 5 * scale,
    24 * scale,
    10 * scale,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.fillStyle = "#5a3828";
  context.fillRect(
    point.x - 5 * scale,
    point.y - 40 * scale,
    10 * scale,
    43 * scale,
  );
  const foliage = [
    [0, -67, 24, "#2f7c4f"],
    [-16, -53, 19, "#3d925e"],
    [17, -51, 20, "#286f47"],
    [0, -42, 23, "#348755"],
  ] as const;
  foliage.forEach(([x, y, radius, color]) => {
    polygon(
      context,
      [
        { x: point.x + (x - radius) * scale, y: point.y + y * scale },
        { x: point.x + x * scale, y: point.y + (y - radius * 0.58) * scale },
        { x: point.x + (x + radius) * scale, y: point.y + y * scale },
        { x: point.x + x * scale, y: point.y + (y + radius * 0.58) * scale },
      ],
      color,
      "rgba(9,43,29,.42)",
      scale,
    );
  });
}

function drawRock(context: CanvasRenderingContext2D, point: Point, zoom: number) {
  polygon(
    context,
    [
      { x: point.x - 9 * zoom, y: point.y },
      { x: point.x - 3 * zoom, y: point.y - 8 * zoom },
      { x: point.x + 8 * zoom, y: point.y - 5 * zoom },
      { x: point.x + 11 * zoom, y: point.y + 2 * zoom },
      { x: point.x, y: point.y + 6 * zoom },
    ],
    "#718183",
    "rgba(18,42,42,.35)",
    zoom,
  );
}

function drawLamp(
  context: CanvasRenderingContext2D,
  point: Point,
  zoom: number,
  time: number,
) {
  context.fillStyle = "#30434a";
  context.fillRect(point.x - 2 * zoom, point.y - 39 * zoom, 4 * zoom, 40 * zoom);
  const pulse = 0.72 + Math.sin(time * 0.003) * 0.08;
  context.fillStyle = `rgba(255, 219, 132, ${pulse * 0.16})`;
  context.beginPath();
  context.arc(point.x, point.y - 42 * zoom, 18 * zoom, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffd987";
  context.fillRect(point.x - 5 * zoom, point.y - 48 * zoom, 10 * zoom, 11 * zoom);
}

function drawDistrictLabel(
  context: CanvasRenderingContext2D,
  district: IsoDistrict,
  point: Point,
  zoom: number,
  active: boolean,
  quest: boolean,
) {
  const y = point.y - (district.kind === "porch" ? 88 : 137) * zoom;
  const label = quest ? `◆  ${district.name.toUpperCase()}` : district.name.toUpperCase();
  context.font = `800 ${Math.max(7, 8 * zoom)}px ui-monospace`;
  const width = context.measureText(label).width + 20 * zoom;
  context.fillStyle = active ? "rgba(7,22,28,.94)" : "rgba(8,25,30,.8)";
  context.fillRect(point.x - width / 2, y - 15 * zoom, width, 22 * zoom);
  context.strokeStyle = quest ? "#ffbe73" : active ? district.color : "rgba(208,238,224,.3)";
  context.lineWidth = Math.max(1, zoom);
  context.strokeRect(point.x - width / 2, y - 15 * zoom, width, 22 * zoom);
  context.fillStyle = quest ? "#ffd398" : "#f1f7ed";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, point.x, y - 4 * zoom);
}

function drawQuestBeacon(
  context: CanvasRenderingContext2D,
  point: Point,
  zoom: number,
  time: number,
) {
  const float = Math.sin(time * 0.004) * 6 * zoom;
  const y = point.y - 166 * zoom + float;
  context.strokeStyle = "rgba(255,190,115,.42)";
  context.lineWidth = 2 * zoom;
  context.beginPath();
  context.ellipse(point.x, point.y - 4 * zoom, 38 * zoom, 16 * zoom, 0, 0, Math.PI * 2);
  context.stroke();
  polygon(
    context,
    [
      { x: point.x, y: y - 13 * zoom },
      { x: point.x + 10 * zoom, y },
      { x: point.x, y: y + 13 * zoom },
      { x: point.x - 10 * zoom, y },
    ],
    "#ffe5a9",
    "#ff985f",
    2 * zoom,
  );
  context.fillStyle = "rgba(255,168,96,.18)";
  context.beginPath();
  context.arc(point.x, y, 28 * zoom, 0, Math.PI * 2);
  context.fill();
}

function drawMuse(
  context: CanvasRenderingContext2D,
  muse: IsoMuse,
  point: Point,
  zoom: number,
  time: number,
  index: number,
  featured: boolean,
  selected: boolean,
) {
  const color = identityColor(muse.name);
  const bob = Math.abs(Math.sin(time * 0.006 + index)) * 2.4 * zoom;
  const foot = Math.sin(time * 0.009 + index) * 2.5 * zoom;
  const baseY = point.y - bob;
  const scale = zoom * (featured || selected ? 1.08 : 1);
  context.fillStyle = "rgba(5,20,23,.2)";
  context.beginPath();
  context.ellipse(
    point.x,
    point.y + 3 * scale,
    11 * scale,
    5 * scale,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  if (featured || selected) {
    context.strokeStyle = featured ? "#ffba72" : "#62ded0";
    context.lineWidth = 2 * scale;
    context.beginPath();
    context.ellipse(
      point.x,
      point.y + 2 * scale,
      16 * scale,
      8 * scale,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }

  context.fillStyle = "#17242d";
  context.fillRect(point.x - 7 * scale, baseY - 26 * scale, 14 * scale, 21 * scale);
  context.fillStyle = color;
  context.fillRect(point.x - 9 * scale, baseY - 31 * scale, 18 * scale, 17 * scale);
  context.fillStyle = shade(color, -35);
  context.fillRect(point.x - 9 * scale, baseY - 17 * scale, 18 * scale, 4 * scale);
  context.fillStyle = "#26343a";
  context.fillRect(point.x - 7 * scale, baseY - 6 * scale, 5 * scale, 9 * scale + foot);
  context.fillRect(point.x + 2 * scale, baseY - 6 * scale, 5 * scale, 9 * scale - foot);
  context.fillStyle = "#10191f";
  context.fillRect(point.x - 9 * scale, baseY - 34 * scale, 18 * scale, 5 * scale);
  context.fillStyle = "#dffcf3";
  context.fillRect(point.x - 5 * scale, baseY - 24 * scale, 3 * scale, 3 * scale);
  context.fillRect(point.x + 2 * scale, baseY - 24 * scale, 3 * scale, 3 * scale);

  if (featured || selected || zoom > 1.25) {
    context.font = `700 ${Math.max(7, 8 * scale)}px ui-monospace`;
    const labelWidth = context.measureText(muse.name).width + 12 * scale;
    const labelY = baseY - 45 * scale;
    context.fillStyle = "rgba(5,18,24,.88)";
    context.fillRect(
      point.x - labelWidth / 2,
      labelY - 9 * scale,
      labelWidth,
      14 * scale,
    );
    context.fillStyle = featured ? "#ffd29d" : "#edf7f2";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(muse.name, point.x, labelY - 2 * scale);
  }
}

function districtMusePoint(
  district: IsoDistrict,
  muse: IsoMuse,
  index: number,
  time: number,
) {
  const seed = hashText(muse.name);
  const angle = (index / 5) * Math.PI * 2 + (seed % 100) / 30;
  const pace = time * (0.00008 + (seed % 7) * 0.000006);
  const radius = 1.45 + (index % 2) * 0.42;
  return {
    x: district.tile[0] + Math.cos(angle + pace) * radius,
    y: district.tile[1] + Math.sin(angle + pace) * radius,
  };
}

export default function IsometricTown({
  districts,
  muses,
  focusedDistrict,
  featuredMuse,
  selectedMuse,
  questDistrictId,
  claimTotal,
  onSelectDistrict,
  onSelectMuse,
}: IsometricTownProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hitsRef = useRef<HitTarget[]>([]);
  const pointerRef = useRef({
    active: false,
    x: 0,
    y: 0,
    moved: 0,
  });
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{
    distance: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const [cameraVersion, setCameraVersion] = useState(0);
  const cameraRef = useRef<CameraState>({
    zoom: 0.86,
    targetZoom: 0.86,
    panX: 0,
    panY: 0,
    targetPanX: 0,
    targetPanY: 0,
    manual: false,
  });

  const musesByDistrict = useMemo(() => {
    const grouped = new Map<string, IsoMuse[]>();
    districts.forEach((district) => grouped.set(district.id, []));
    muses.forEach((muse) => {
      const group = grouped.get(muse.district) || grouped.get("lobby");
      if (group && group.length < 5) group.push(muse);
    });
    return grouped;
  }, [districts, muses]);

  useEffect(() => {
    const camera = cameraRef.current;
    camera.manual = false;
    if (!focusedDistrict) {
      camera.targetPanX = 0;
      camera.targetPanY = 0;
      camera.targetZoom = window.innerWidth < 700 ? 0.66 : 0.86;
      return;
    }
    const [x, y] = focusedDistrict.tile;
    const zoom = window.innerWidth < 700 ? 0.92 : 1.12;
    camera.targetZoom = zoom;
    camera.targetPanX =
      -(x - WORLD_CENTER[0] - (y - WORLD_CENTER[1])) *
      HALF_TILE_WIDTH *
      zoom;
    camera.targetPanY =
      -(x - WORLD_CENTER[0] + (y - WORLD_CENTER[1])) *
        HALF_TILE_HEIGHT *
        zoom +
      35;
  }, [focusedDistrict, cameraVersion]);

  useEffect(() => {
    const moveCamera = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      const camera = cameraRef.current;
      const step = event.shiftKey ? 105 : 52;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        camera.manual = true;
        camera.targetPanX += step;
      } else if (
        event.key === "ArrowRight" ||
        event.key.toLowerCase() === "d"
      ) {
        camera.manual = true;
        camera.targetPanX -= step;
      } else if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        camera.manual = true;
        camera.targetPanY += step;
      } else if (
        event.key === "ArrowDown" ||
        event.key.toLowerCase() === "s"
      ) {
        camera.manual = true;
        camera.targetPanY -= step;
      } else if (event.key === "+" || event.key === "=") {
        camera.manual = true;
        camera.targetZoom = Math.min(1.55, camera.targetZoom + 0.12);
      } else if (event.key === "-" || event.key === "_") {
        camera.manual = true;
        camera.targetZoom = Math.max(0.5, camera.targetZoom - 0.12);
      } else if (event.key === "0") {
        camera.manual = false;
        camera.targetPanX = 0;
        camera.targetPanY = 0;
        camera.targetZoom = window.innerWidth < 700 ? 0.66 : 0.86;
      } else {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", moveCamera);
    return () => window.removeEventListener("keydown", moveCamera);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const zoomCamera = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      camera.manual = true;
      camera.targetZoom = Math.max(
        0.5,
        Math.min(1.55, camera.targetZoom - event.deltaY * 0.0008),
      );
    };
    canvas.addEventListener("wheel", zoomCamera, { passive: false });
    return () => canvas.removeEventListener("wheel", zoomCamera);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let lastFrame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetFrame = reducedMotion ? 1000 / 8 : 1000 / 60;

    const resize = () => {
      const bounds = wrap.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const fit = Math.min(width / 1260, height / 710);
      if (!cameraRef.current.manual && !focusedDistrict) {
        cameraRef.current.zoom = Math.max(0.58, Math.min(0.9, fit));
        cameraRef.current.targetZoom = cameraRef.current.zoom;
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const render = (time: number) => {
      frame = requestAnimationFrame(render);
      if (time - lastFrame < targetFrame) return;
      lastFrame = time;
      const camera = cameraRef.current;
      camera.zoom += (camera.targetZoom - camera.zoom) * 0.08;
      camera.panX += (camera.targetPanX - camera.panX) * 0.09;
      camera.panY += (camera.targetPanY - camera.panY) * 0.09;
      hitsRef.current = [];

      const background = context.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "#9ad9ce");
      background.addColorStop(0.42, "#68b7aa");
      background.addColorStop(1, "#317f78");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.fillStyle = "rgba(220,250,240,.18)";
      for (let index = 0; index < 14; index += 1) {
        const cloudX = ((time * 0.008 + index * 157) % (width + 240)) - 120;
        const cloudY = 45 + (index % 4) * 53;
        context.beginPath();
        context.ellipse(cloudX, cloudY, 55, 15, -0.18, 0, Math.PI * 2);
        context.fill();
      }

      for (let sum = 0; sum <= MAP_WIDTH + MAP_HEIGHT - 2; sum += 1) {
        for (let x = 0; x < MAP_WIDTH; x += 1) {
          const y = sum - x;
          if (y < 0 || y >= MAP_HEIGHT) continue;
          const point = isoPoint(x, y, width, height, camera);
          const plaza = isPlazaTile(x, y);
          const road = isRoadTile(x, y);
          const alternate = (x + y) % 2 === 0;
          drawDiamond(
            context,
            point,
            camera.zoom,
            plaza
              ? alternate
                ? "#c8c4ad"
                : "#b9b6a3"
              : road
                ? alternate
                  ? "#b79b76"
                  : "#ad916e"
                : alternate
                  ? "#63ad69"
                  : "#5ca563",
            plaza
              ? "rgba(84,83,73,.22)"
              : road
                ? "rgba(100,76,50,.18)"
                : "rgba(43,105,55,.14)",
          );
        }
      }

      const drawables: {
        order: number;
        draw: () => void;
      }[] = [];

      rockPositions.forEach(([x, y]) => {
        drawables.push({
          order: x + y,
          draw: () => drawRock(context, isoPoint(x, y, width, height, camera), camera.zoom),
        });
      });

      sceneryTrees.forEach(([x, y, size]) => {
        drawables.push({
          order: x + y,
          draw: () =>
            drawTree(
              context,
              isoPoint(x, y, width, height, camera),
              camera.zoom,
              size,
            ),
        });
      });

      [
        [9.2, 9],
        [14.8, 9],
        [12, 6.4],
        [12, 11.7],
        [6, 7.2],
        [18, 11.8],
      ].forEach(([x, y]) => {
        drawables.push({
          order: x + y + 0.1,
          draw: () =>
            drawLamp(
              context,
              isoPoint(x, y, width, height, camera),
              camera.zoom,
              time,
            ),
        });
      });

      districts.forEach((district) => {
        const point = isoPoint(
          district.tile[0],
          district.tile[1],
          width,
          height,
          camera,
        );
        drawables.push({
          order: district.tile[0] + district.tile[1],
          draw: () => {
            drawBuilding(context, district, point, camera.zoom, time, claimTotal);
            const active =
              focusedDistrict?.id === district.id ||
              featuredMuse?.district === district.id ||
              selectedMuse?.district === district.id;
            drawDistrictLabel(
              context,
              district,
              point,
              camera.zoom,
              active,
              questDistrictId === district.id,
            );
            if (questDistrictId === district.id) {
              drawQuestBeacon(context, point, camera.zoom, time);
            }
            hitsRef.current.push({
              type: "district",
              id: district.id,
              x: point.x,
              y: point.y - 55 * camera.zoom,
              radius: 72 * camera.zoom,
            });
          },
        });

        (musesByDistrict.get(district.id) || []).forEach((muse, index) => {
          const worldPoint = districtMusePoint(district, muse, index, time);
          const screenPoint = isoPoint(worldPoint.x, worldPoint.y, width, height, camera);
          drawables.push({
            order: worldPoint.x + worldPoint.y + 0.5,
            draw: () => {
              const featured =
                featuredMuse?.id === muse.id &&
                featuredMuse.district === muse.district;
              const selected =
                selectedMuse?.id === muse.id &&
                selectedMuse.district === muse.district;
              drawMuse(
                context,
                muse,
                screenPoint,
                camera.zoom,
                time,
                index,
                featured,
                selected,
              );
              hitsRef.current.push({
                type: "muse",
                muse,
                x: screenPoint.x,
                y: screenPoint.y - 20 * camera.zoom,
                radius: 19 * camera.zoom,
              });
            },
          });
        });
      });

      drawables
        .sort((a, b) => a.order - b.order)
        .forEach((drawable) => drawable.draw());

      const vignette = context.createRadialGradient(
        width / 2,
        height * 0.48,
        height * 0.18,
        width / 2,
        height * 0.48,
        Math.max(width, height) * 0.72,
      );
      vignette.addColorStop(0, "rgba(3,18,20,0)");
      vignette.addColorStop(1, "rgba(3,18,20,.25)");
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    };

    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    claimTotal,
    districts,
    featuredMuse,
    focusedDistrict,
    musesByDistrict,
    questDistrictId,
    selectedMuse,
  ]);

  const setZoom = (next: number) => {
    const camera = cameraRef.current;
    camera.manual = true;
    camera.targetZoom = Math.max(0.5, Math.min(1.55, next));
  };

  const recenter = () => {
    const camera = cameraRef.current;
    camera.manual = false;
    camera.targetPanX = 0;
    camera.targetPanY = 0;
    camera.targetZoom = window.innerWidth < 700 ? 0.66 : 0.86;
    setCameraVersion((version) => version + 1);
  };

  return (
    <div className="iso-world" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        aria-label="Live isometric Muse Town. Drag to pan, scroll to zoom, and select a Muse or district."
        onPointerDown={(event) => {
          pointersRef.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          pointerRef.current = {
            active: true,
            x: event.clientX,
            y: event.clientY,
            moved: 0,
          };
          if (pointersRef.current.size === 2) {
            const [first, second] = [...pointersRef.current.values()];
            pinchRef.current = {
              distance: Math.hypot(second.x - first.x, second.y - first.y),
              centerX: (first.x + second.x) / 2,
              centerY: (first.y + second.y) / 2,
            };
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const pointer = pointerRef.current;
          if (!pointer.active) {
            const bounds = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - bounds.left;
            const y = event.clientY - bounds.top;
            const hovered = [...hitsRef.current]
              .reverse()
              .some((hit) => Math.hypot(hit.x - x, hit.y - y) <= hit.radius);
            event.currentTarget.style.cursor = hovered ? "pointer" : "grab";
            return;
          }
          if (pointersRef.current.has(event.pointerId)) {
            pointersRef.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
          }
          if (pointersRef.current.size >= 2) {
            const [first, second] = [...pointersRef.current.values()];
            const distance = Math.hypot(
              second.x - first.x,
              second.y - first.y,
            );
            const centerX = (first.x + second.x) / 2;
            const centerY = (first.y + second.y) / 2;
            const previous = pinchRef.current;
            if (previous && previous.distance > 0) {
              const camera = cameraRef.current;
              camera.manual = true;
              camera.targetZoom = Math.max(
                0.5,
                Math.min(
                  1.55,
                  camera.targetZoom * (distance / previous.distance),
                ),
              );
              camera.targetPanX += centerX - previous.centerX;
              camera.targetPanY += centerY - previous.centerY;
              pointer.moved += Math.abs(distance - previous.distance) + 10;
            }
            pinchRef.current = { distance, centerX, centerY };
            return;
          }
          const deltaX = event.clientX - pointer.x;
          const deltaY = event.clientY - pointer.y;
          pointer.x = event.clientX;
          pointer.y = event.clientY;
          pointer.moved += Math.abs(deltaX) + Math.abs(deltaY);
          const camera = cameraRef.current;
          camera.manual = true;
          camera.targetPanX += deltaX;
          camera.targetPanY += deltaY;
          event.currentTarget.style.cursor = "grabbing";
        }}
        onPointerUp={(event) => {
          const pointer = pointerRef.current;
          pointersRef.current.delete(event.pointerId);
          pinchRef.current = null;
          if (pointersRef.current.size === 1) {
            const [remaining] = [...pointersRef.current.values()];
            pointerRef.current = {
              active: true,
              x: remaining.x,
              y: remaining.y,
              moved: 10,
            };
            return;
          }
          pointer.active = false;
          event.currentTarget.style.cursor = "grab";
          if (pointer.moved > 8) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left;
          const y = event.clientY - bounds.top;
          const target = [...hitsRef.current]
            .reverse()
            .find((hit) => Math.hypot(hit.x - x, hit.y - y) <= hit.radius);
          if (!target) return;
          if (target.type === "muse") onSelectMuse(target.muse);
          else onSelectDistrict(target.id);
        }}
        onPointerCancel={() => {
          pointerRef.current.active = false;
          pointersRef.current.clear();
          pinchRef.current = null;
        }}
      />
      <div className="iso-location">
        <span>{focusedDistrict ? "DISTRICT FOCUS" : "LIVE WORLD"}</span>
        <strong>{focusedDistrict?.name || "Muse Town"}</strong>
        <small>
          {focusedDistrict?.description ||
            "Public Muse activity rendered as movement—not private thought."}
        </small>
      </div>
      <div className="iso-controls" aria-label="Map controls">
        <button
          onClick={() => setZoom(cameraRef.current.targetZoom + 0.12)}
          aria-label="Zoom in"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => setZoom(cameraRef.current.targetZoom - 0.12)}
          aria-label="Zoom out"
        >
          <Minus size={14} />
        </button>
        <button onClick={recenter} aria-label="Recenter map">
          <Scan size={14} />
        </button>
      </div>
      <div className="iso-hint">DRAG TO PAN · SCROLL TO ZOOM · SELECT TO INSPECT</div>
    </div>
  );
}
