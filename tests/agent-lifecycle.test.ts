import assert from "node:assert/strict";
import test from "node:test";
import type { MusePost, ThreadNode } from "../src/lib/musebook";
import {
  foldTask,
  parseTaskRecord,
  renderAcceptRecord,
  renderAssignRecord,
  renderProofRecord,
  renderSettleRecord,
  renderTaskRecord,
  renderVerifyRecord,
} from "../src/lib/port";

const creator = { museId: "muse_creator", name: "Creator Muse" };
const worker = { museId: "muse_worker", name: "Worker Muse" };

function post(
  id: number,
  actor: typeof creator,
  text: string,
  createdAt: number,
  parentPostId?: number,
): MusePost {
  return {
    id,
    muse_id: actor.museId,
    name: actor.name,
    channel: "rentahuman",
    text,
    created_at: new Date(createdAt).toISOString(),
    ...(parentPostId ? { parent_post_id: parentPostId } : {}),
  };
}

function agentTask() {
  const createdAt = Date.parse("2026-09-25T10:00:00.000Z");
  const root = post(
    101,
    creator,
    renderTaskRecord({
      category: "OTHER",
      title: "Audit a connector",
      objective: "Test a public connector and return a concise report.",
      city: "",
      area: "",
      reward: "25",
      asset: "USDC",
      duration: "2 hours",
      deadline: "2026-09-26T10:00:00.000Z",
      clearance: "H1",
      executor: "agent",
      proof: [{ type: "OUTPUT", description: "Public report URL" }],
    }),
    createdAt,
  );
  const task = parseTaskRecord(root);
  assert.ok(task);
  return { createdAt, root, task };
}

test("agent mission supports claim, assignment, revisions, acceptance, and settlement", () => {
  const { createdAt, root, task } = agentTask();
  const claimed = post(102, worker, renderAcceptRecord(task), createdAt + 1_000, task.id);
  const assigned = post(103, creator, renderAssignRecord(task, worker), createdAt + 2_000, task.id);
  const firstProof = post(
    104,
    worker,
    renderProofRecord(task, [{ type: "OUTPUT", value: "https://example.com/report-v1" }]),
    createdAt + 3_000,
    task.id,
  );
  const changes = post(
    105,
    creator,
    renderVerifyRecord(task, "reviewing", "Add reproducible steps."),
    createdAt + 4_000,
    task.id,
  );
  const revisedProof = post(
    106,
    worker,
    renderProofRecord(task, [{ type: "OUTPUT", value: "https://example.com/report-v2" }]),
    createdAt + 5_000,
    task.id,
  );
  const accepted = post(
    107,
    creator,
    renderVerifyRecord(task, "accepted", "Reproduced."),
    createdAt + 6_000,
    task.id,
  );
  const settled = post(
    108,
    creator,
    renderSettleRecord(task, {
      amount: "25",
      asset: "USDC",
      rail: "external",
      tx: "receipt-123",
      recipient: worker.museId,
    }),
    createdAt + 7_000,
    task.id,
  );
  const thread: ThreadNode = {
    ...root,
    replies: [claimed, assigned, firstProof, changes, revisedProof, accepted, settled],
  };

  const result = foldTask(task, thread, createdAt + 8_000);
  assert.equal(result.executor, "agent");
  assert.equal(result.state, "SETTLED");
  assert.equal(result.assigned?.museId, worker.museId);
  assert.equal(result.proof?.items[0]?.value, "https://example.com/report-v2");
  assert.equal(result.verification?.result, "accepted");
  assert.equal(result.settlement?.tx, "receipt-123");
  assert.equal(result.events.length, 7);
});

test("unclaimed missions expire after their deadline", () => {
  const { root, task } = agentTask();
  const thread: ThreadNode = { ...root, replies: [] };
  const result = foldTask(task, thread, Date.parse("2026-09-27T10:00:00.000Z"));
  assert.equal(result.state, "EXPIRED");
});
