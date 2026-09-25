import type { PortTask } from "./port.js";

export type InboxItem = {
  id: string;
  kind: "claim" | "assignment" | "review" | "changes" | "payment" | "settled" | "opportunity";
  title: string;
  body: string;
  href: string;
  at: number;
  priority: "action" | "update" | "discovery";
};

function updatedAt(task: PortTask) {
  return Math.max(task.createdAt, ...task.events.map((event) => event.at));
}

export function inboxForMuse(museId: string, tasks: PortTask[]): InboxItem[] {
  if (!museId) return [];
  const items: InboxItem[] = [];

  tasks.forEach((task) => {
    const creator = task.creator.museId === museId;
    const assigned = task.assigned?.museId === museId;
    const candidate = task.candidates.some((actor) => actor.museId === museId);
    const href = `/executions/${task.id}`;
    const at = updatedAt(task);

    if (creator && task.candidates.length && !task.assigned) {
      items.push({
        id: `${task.ref}:claims`,
        kind: "claim",
        title: `${task.candidates.length} claim${task.candidates.length === 1 ? "" : "s"} need a decision`,
        body: task.title,
        href,
        at,
        priority: "action",
      });
    }
    if (creator && task.proof && ["PROOF_SUBMITTED", "VERIFYING"].includes(task.state)) {
      items.push({
        id: `${task.ref}:review`,
        kind: "review",
        title: "Proof is ready to review",
        body: task.title,
        href,
        at,
        priority: "action",
      });
    }
    if (creator && task.state === "COMPLETE" && !task.settlement) {
      items.push({
        id: `${task.ref}:payment`,
        kind: "payment",
        title: "Accepted mission needs payment",
        body: task.title,
        href,
        at,
        priority: "action",
      });
    }
    if (assigned && task.state === "ASSIGNED") {
      items.push({
        id: `${task.ref}:assigned`,
        kind: "assignment",
        title: "You were selected",
        body: task.title,
        href,
        at,
        priority: "action",
      });
    }
    if (assigned && task.state === "VERIFYING" && task.verification?.result === "reviewing") {
      items.push({
        id: `${task.ref}:changes`,
        kind: "changes",
        title: "Requester asked for changes",
        body: task.verification.note || task.title,
        href,
        at,
        priority: "action",
      });
    }
    if ((assigned || creator) && task.state === "SETTLED") {
      items.push({
        id: `${task.ref}:settled`,
        kind: "settled",
        title: "Mission settlement recorded",
        body: `${task.title} · ${task.settlement?.amount ?? "—"} ${task.settlement?.asset ?? task.asset}`,
        href,
        at,
        priority: "update",
      });
    }
    if (
      task.executor === "agent" &&
      ["OPEN", "MATCHING"].includes(task.state) &&
      !creator &&
      !candidate
    ) {
      items.push({
        id: `${task.ref}:opportunity`,
        kind: "opportunity",
        title: "Open mission for a working Muse",
        body: `${task.title} · ${task.reward ?? "—"} ${task.asset}`,
        href,
        at,
        priority: "discovery",
      });
    }
  });

  return items.sort((a, b) => {
    const rank = { action: 0, update: 1, discovery: 2 };
    return rank[a.priority] - rank[b.priority] || b.at - a.at;
  });
}
