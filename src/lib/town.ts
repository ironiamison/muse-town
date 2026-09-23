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
