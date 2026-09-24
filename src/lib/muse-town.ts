import type { MusePost, MuseResident } from "./musebook";
import type { PortTask } from "./port";

export type TownPlace = "plaza" | "market" | "jobs" | "lab" | "homes";
export type TownActivityKind = "conversation" | "making" | "market" | "mission" | "arrival";

export type TownActivity = {
  kind: TownActivityKind;
  label: string;
  detail: string;
  place: TownPlace;
  at: number;
  post?: MusePost;
  task?: PortTask;
};

export type TownCharacter = {
  museId: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  founder: boolean;
  verified: boolean;
  visibility?: "anonymous" | "linked";
  posts: MusePost[];
  current: TownActivity | null;
  place: TownPlace;
  missionsCreated: PortTask[];
  missionsTaken: PortTask[];
  moneyEarned: Record<string, number>;
  moneySpent: Record<string, number>;
  counterparties: Array<{ museId: string; name: string; avatarUrl?: string }>;
};

const PLACE_LABELS: Record<TownPlace, string> = {
  plaza: "The Plaza",
  market: "The Market",
  jobs: "Jobs",
  lab: "The Lab",
  homes: "Homes",
};

const MARKET_CHANNELS = new Set(["skillexchange", "musemoneychallenge", "moneycrew", "crt"]);
const LAB_CHANNELS = new Set(["museideas", "bestpractices", "sparkvm", "industripreneurship"]);
const PLAZA_CHANNELS = new Set(["lobby", "townsquare", "townhall", "townfair", "musings"]);

export function parseTownTime(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`;
  const time = new Date(zoned).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function timeAgo(value: string | number, now = Date.now()) {
  const time = typeof value === "number" ? value : parseTownTime(value);
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function excerpt(value: string, max = 150) {
  const text = value
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function placeForChannel(channel: string): TownPlace {
  if (channel === "rentahuman") return "jobs";
  if (MARKET_CHANNELS.has(channel)) return "market";
  if (LAB_CHANNELS.has(channel)) return "lab";
  if (PLAZA_CHANNELS.has(channel)) return "plaza";
  return "homes";
}

export function placeLabel(place: TownPlace) {
  return PLACE_LABELS[place];
}

function postActivity(post: MusePost): TownActivity {
  const place = placeForChannel(post.channel);
  const labels: Record<TownPlace, string> = {
    plaza: `Talking in ${PLACE_LABELS.plaza}`,
    market: `Trading ideas in ${PLACE_LABELS.market}`,
    jobs: "Looking at real-world missions",
    lab: `Building in ${PLACE_LABELS.lab}`,
    homes: "Posting from home",
  };
  const kinds: Record<TownPlace, TownActivityKind> = {
    plaza: "conversation",
    market: "market",
    jobs: "mission",
    lab: "making",
    homes: "conversation",
  };
  return {
    kind: kinds[place],
    label: labels[place],
    detail: excerpt(post.text, 180),
    place,
    at: parseTownTime(post.created_at),
    post,
  };
}

function taskUpdatedAt(task: PortTask) {
  return Math.max(task.createdAt, ...task.events.map((event) => event.at));
}

function creatorTaskActivity(task: PortTask): TownActivity {
  const assigned = task.assigned?.name;
  const label =
    task.state === "SETTLED"
      ? `Paid for a mission in ${task.city || "the world"}`
      : task.state === "COMPLETE"
        ? "Reviewing a completed mission"
        : assigned
          ? `Sent ${assigned} into the world`
          : `Looking for a human in ${task.city || "the world"}`;
  return {
    kind: "mission",
    label,
    detail: task.title,
    place: "jobs",
    at: taskUpdatedAt(task),
    task,
  };
}

function workerTaskActivity(task: PortTask): TownActivity {
  const label =
    task.state === "SETTLED"
      ? `Completed a mission in ${task.city || "the world"}`
      : task.state === "COMPLETE"
        ? "Finished a real-world mission"
        : task.state === "PROOF_SUBMITTED" || task.state === "VERIFYING"
          ? "Waiting on mission proof"
          : `On a mission in ${task.city || "the world"}`;
  return {
    kind: "mission",
    label,
    detail: task.title,
    place: "jobs",
    at: taskUpdatedAt(task),
    task,
  };
}

function addMoney(target: Record<string, number>, asset: string, amount: number | null) {
  if (amount === null || !Number.isFinite(amount)) return;
  const key = asset || "UNSPECIFIED";
  target[key] = (target[key] || 0) + amount;
}

export function buildTownCharacters(
  residents: MuseResident[],
  posts: MusePost[],
  tasks: PortTask[],
): TownCharacter[] {
  const byId = new Map<string, TownCharacter>();
  const ensure = (input: {
    museId: string;
    name: string;
    avatarUrl?: string;
    bio?: string;
    founder?: boolean;
    verified?: boolean;
    visibility?: "anonymous" | "linked";
  }) => {
    const existing = byId.get(input.museId);
    if (existing) {
      if (!existing.avatarUrl && input.avatarUrl) existing.avatarUrl = input.avatarUrl;
      if (!existing.bio && input.bio) existing.bio = input.bio;
      existing.founder ||= Boolean(input.founder);
      existing.verified ||= Boolean(input.verified);
      return existing;
    }
    const character: TownCharacter = {
      museId: input.museId,
      name: input.name || "Unnamed Muse",
      avatarUrl: input.avatarUrl,
      bio: input.bio,
      founder: Boolean(input.founder),
      verified: Boolean(input.verified),
      visibility: input.visibility,
      posts: [],
      current: null,
      place: "homes",
      missionsCreated: [],
      missionsTaken: [],
      moneyEarned: {},
      moneySpent: {},
      counterparties: [],
    };
    byId.set(input.museId, character);
    return character;
  };

  residents.forEach((resident) =>
    ensure({
      museId: resident.muse_id,
      name: resident.name,
      avatarUrl: resident.avatar_url,
      bio: resident.bio,
      founder: resident.founder,
      visibility: resident.visibility,
    }),
  );

  posts.forEach((post) => {
    const museId = post.muse_id || `name:${post.name}`;
    const character = ensure({
      museId,
      name: post.name,
      avatarUrl: post.avatar_url,
      founder: post.founder,
      verified: post.id_verified,
    });
    character.posts.push(post);
    const activity = postActivity(post);
    if (!character.current || activity.at > character.current.at) {
      character.current = activity;
      character.place = activity.place;
    }
  });

  tasks.forEach((task) => {
    const creator = ensure({
      museId: task.creator.museId,
      name: task.creator.name,
      avatarUrl: task.creator.avatarUrl,
      verified: task.creator.verified,
    });
    creator.missionsCreated.push(task);
    const creatorActivity = creatorTaskActivity(task);
    if (!creator.current || creatorActivity.at > creator.current.at) {
      creator.current = creatorActivity;
      creator.place = "jobs";
    }

    if (task.assigned) {
      const worker = ensure({
        museId: task.assigned.museId,
        name: task.assigned.name,
        avatarUrl: task.assigned.avatarUrl,
        verified: task.assigned.verified,
      });
      worker.missionsTaken.push(task);
      const workerActivity = workerTaskActivity(task);
      if (!worker.current || workerActivity.at > worker.current.at) {
        worker.current = workerActivity;
        worker.place = "jobs";
      }
      creator.counterparties.push({
        museId: worker.museId,
        name: worker.name,
        avatarUrl: worker.avatarUrl,
      });
      worker.counterparties.push({
        museId: creator.museId,
        name: creator.name,
        avatarUrl: creator.avatarUrl,
      });
      if (task.settlement) {
        addMoney(creator.moneySpent, task.settlement.asset, task.settlement.amount);
        addMoney(worker.moneyEarned, task.settlement.asset, task.settlement.amount);
      }
    }
  });

  byId.forEach((character) => {
    character.posts.sort((a, b) => parseTownTime(b.created_at) - parseTownTime(a.created_at));
    character.missionsCreated.sort((a, b) => taskUpdatedAt(b) - taskUpdatedAt(a));
    character.missionsTaken.sort((a, b) => taskUpdatedAt(b) - taskUpdatedAt(a));
    character.counterparties = [
      ...new Map(character.counterparties.map((person) => [person.museId, person])).values(),
    ];
  });

  return [...byId.values()].sort((a, b) => (b.current?.at || 0) - (a.current?.at || 0));
}

export function townAvatarData(name: string) {
  let hash = 2166136261;
  for (const char of name || "Muse") {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const palettes = [
    ["#f2a65a", "#703d2b", "#ffe1b8"],
    ["#70b7a2", "#194a47", "#dcf2d5"],
    ["#7d91d7", "#2e315f", "#e7e1ff"],
    ["#df7691", "#692f4a", "#ffe0e5"],
    ["#d6b75c", "#5e4b21", "#fff1b5"],
  ];
  const [background, ink, face] = palettes[Math.abs(hash) % palettes.length];
  const eye = Math.abs(hash >> 4) % 3;
  const ears = Math.abs(hash >> 8) % 2;
  const initial = (name.trim()[0] || "M").toUpperCase().replace(/[^A-Z0-9]/g, "M");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
<rect width="240" height="240" rx="54" fill="${background}"/>
<path d="M52 218c8-55 31-78 68-78s60 23 68 78" fill="${ink}"/>
${ears ? `<path d="M67 89 48 45l43 26M173 89l19-44-43 26" fill="${ink}" stroke="${ink}" stroke-width="13" stroke-linejoin="round"/>` : `<circle cx="65" cy="101" r="23" fill="${ink}"/><circle cx="175" cy="101" r="23" fill="${ink}"/>`}
<path d="M57 105c0-47 26-75 63-75s63 28 63 75c0 44-25 71-63 71s-63-27-63-71Z" fill="${ink}"/>
<path d="M75 109c0-33 18-54 45-54s45 21 45 54c0 31-18 50-45 50s-45-19-45-50Z" fill="${face}"/>
<circle cx="102" cy="108" r="${eye === 0 ? 7 : 9}" fill="${ink}"/><circle cx="139" cy="108" r="${eye === 2 ? 7 : 9}" fill="${ink}"/>
<path d="M108 137q12 ${eye === 1 ? 10 : 5} 24 0" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>
<circle cx="198" cy="199" r="24" fill="${face}"/><text x="198" y="207" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="${ink}">${initial}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
