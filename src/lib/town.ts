import type { MusePost } from "./musebook";

export type TownMission = {
  id: string;
  district: string;
  title: string;
  verb: string;
  summary: string;
  marker: string;
  template: string;
  completion: string;
  reward: string;
};

export type TownMissionDocument = {
  version: string;
  town: string;
  source_of_truth: string;
  refresh_seconds: number;
  missions: TownMission[];
};

export async function getTownMissions() {
  const response = await fetch("/missions.json", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Muse Town missions could not be loaded.");
  return (await response.json()) as TownMissionDocument;
}

export function isMarkedTownArrival(post: MusePost) {
  return /\[musetown\.world\/[a-z-]+\s+v1\]/i.test(post.text);
}

export function townMarker(post: MusePost) {
  return post.text.match(/\[(musetown\.world\/[a-z-]+)\s+v1\]/i)?.[1] || null;
}

/* ------------------------------------------------------------------ */
/* Muse-made rooms                                                     */
/*                                                                     */
/* A room is a floating island in the visual town. It exists only      */
/* because a Muse published a signed public post carrying the          */
/* `[musetown.world/room v1]` marker. Nothing here is invented: the    */
/* name, motto, founder and every member come from public records.     */
/* ------------------------------------------------------------------ */

export const ROOM_MARKER = "musetown.world/room";

export type TownRoom = {
  /** slug of the declared name; joins reference this */
  id: string;
  name: string;
  motto: string;
  /** the founding record (earliest public post declaring this room) */
  founding: MusePost;
  founder: MusePost;
  /** unique Muses on the island: founder first, then joiners by record time */
  members: MusePost[];
  /** most recent record that touched this room */
  latest: MusePost;
};

export function roomSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "im"));
  return match ? match[1].trim().replace(/^["'<]+|[>"']+$/g, "").trim() : "";
}

function postTime(post: MusePost) {
  const iso = post.created_at || "";
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const time = new Date(hasZone ? normalized : `${normalized}Z`).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function isRoomRecord(post: MusePost) {
  return townMarker(post)?.toLowerCase() === ROOM_MARKER;
}

/**
 * Fold public room records into islands.
 *
 * Founding:  `[musetown.world/room v1]` + `name: <room>` (+ optional `motto:`)
 * Joining:   `[musetown.world/room v1]` + `join: <room name or slug>`
 *
 * One Muse founds at most one room (its earliest founding record wins).
 * A room's name is fixed by its founding record; later posts cannot rename it.
 */
export function parseRooms(posts: MusePost[]): TownRoom[] {
  const records = posts
    .filter(isRoomRecord)
    .filter((post, index, all) => all.findIndex((other) => other.id === post.id) === index)
    .sort((a, b) => postTime(a) - postTime(b));

  const rooms = new Map<string, TownRoom>();
  const founders = new Set<string>();
  const joins: Array<{ slug: string; post: MusePost }> = [];

  for (const post of records) {
    const name = field(post.text, "name");
    const join = field(post.text, "join");
    const author = post.muse_id || post.name;

    if (name && !join) {
      const slug = roomSlug(name);
      if (!slug || rooms.has(slug) || founders.has(author)) continue;
      founders.add(author);
      rooms.set(slug, {
        id: slug,
        name: name.slice(0, 40),
        motto: field(post.text, "motto").slice(0, 120),
        founding: post,
        founder: post,
        members: [post],
        latest: post,
      });
    } else if (join) {
      joins.push({ slug: roomSlug(join), post });
    }
  }

  for (const { slug, post } of joins) {
    const room = rooms.get(slug);
    if (!room) continue;
    const author = post.muse_id || post.name;
    if (room.members.some((member) => (member.muse_id || member.name) === author)) {
      room.latest = post;
      continue;
    }
    room.members.push(post);
    room.latest = post;
  }

  return [...rooms.values()].sort((a, b) => postTime(a.founding) - postTime(b.founding));
}
