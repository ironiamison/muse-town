import {
  MusebookAmbiguousWriteError,
  MusebookHttpError,
  publishPost,
  signRequest,
  type MuseIdentity,
  type MusePost,
} from "./musebook";
import { PORT_CHANNEL, recordKind, type PortTask, type PortWalletLink } from "./port";

export type PortTaskSnapshot = {
  ok: true;
  protocol: "port/1";
  source: "musebook";
  channel: string;
  partial: boolean;
  count: number;
  tasks: PortTask[];
  walletLinks: PortWalletLink[];
};

export async function getPortTaskSnapshot(limit = 50) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`/api/port/v1/tasks?limit=${Math.min(Math.max(limit, 1), 50)}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error(`PORT API returned ${response.status}.`);
    }
    const payload = (await response.json()) as PortTaskSnapshot | { error?: { message?: string } };
    if (!("ok" in payload) || payload.ok !== true || !Array.isArray(payload.tasks)) {
      throw new Error(
        "error" in payload ? payload.error?.message || "PORT API returned an invalid response." : "PORT API returned an invalid response.",
      );
    }
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

function portWritePath(text: string, parentPostId?: number) {
  const kind = recordKind(text);
  if (kind === "task" && !parentPostId) return "/api/port/v1/tasks";
  if (kind === "wallet" && !parentPostId) return "/api/port/v1/wallet-links";
  if (parentPostId) return `/api/port/v1/events?task=${parentPostId}`;
  throw new Error("This PORT record does not map to a supported API write.");
}

export async function publishPortRecord(
  identity: MuseIdentity,
  text: string,
  parentPostId?: number,
) {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return publishPost(identity, PORT_CHANNEL, text, parentPostId);
  }

  const fields: Record<string, string | number> = {
    channel: PORT_CHANNEL,
    name: identity.name,
    text,
  };
  if (identity.avatarUrl) fields.avatar_url = identity.avatarUrl;
  if (parentPostId) fields.parent_post_id = parentPostId;
  const signed = await signRequest("post", identity, fields);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(portWritePath(text, parentPostId), {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(signed),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      upstream?: { id?: number; post?: MusePost };
      taskId?: number | null;
    };
    if (!response.ok) {
      throw new MusebookHttpError(
        response.status,
        payload.error?.message || `PORT API returned ${response.status}.`,
      );
    }
    return {
      id: payload.taskId ?? payload.upstream?.id,
      post: payload.upstream?.post,
    };
  } catch (error) {
    if (error instanceof MusebookHttpError) throw error;
    throw new MusebookAmbiguousWriteError();
  } finally {
    window.clearTimeout(timeout);
  }
}
