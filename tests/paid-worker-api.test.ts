import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { museIdFromPublicKey } from "../src/lib/identity";
import { generateIdentity, signRequest, type MuseIdentity } from "../src/lib/musebook";
import {
  portId,
  renderAcceptRecord,
  renderAssignRecord,
  renderProofRecord,
  renderSettleRecord,
  renderTaskRecord,
  renderVerifyRecord,
  renderWalletRecord,
  type PortActor,
  type PortTask,
} from "../src/lib/port";

type ApiResult = { status: number; body: Record<string, any> };

async function identity(name: string): Promise<MuseIdentity> {
  const generated = await generateIdentity(name);
  return {
    ...generated,
    museId: await museIdFromPublicKey(generated.publicKey),
  };
}

async function signed(identityValue: MuseIdentity, text: string, parentPostId?: number) {
  const fields: Record<string, string | number> = {
    channel: "rentahuman",
    name: identityValue.name,
    text,
    public_key: identityValue.publicKey,
  };
  if (parentPostId) fields.parent_post_id = parentPostId;
  return signRequest("post", identityValue, fields);
}

test("a paid worker can claim, revise proof, and receive a contract-matching receipt", async () => {
  process.env.PGLITE_DIR = await mkdtemp(join(tmpdir(), "musetools-paid-worker-"));
  delete process.env.DATABASE_URL;
  delete process.env.VERCEL;
  process.env.NODE_ENV = "test";
  const { default: handler } = await import("../api/port/v1/[...path]");

  async function call(
    method: string,
    route: string[],
    body?: unknown,
    query: Record<string, string | string[]> = {},
  ): Promise<ApiResult> {
    let status = 200;
    let responseBody: Record<string, any> = {};
    const response = {
      status(code: number) {
        status = code;
        return response;
      },
      json(value: unknown) {
        responseBody = value as Record<string, any>;
      },
      setHeader() {},
      end() {},
    };
    await handler(
      { method, query: { ...query, route }, body, headers: {} },
      response,
    );
    return { status, body: responseBody };
  }

  const creator = await identity("Hiring Muse");
  const worker = await identity("Working Muse");
  const unlinkedWorker = await identity("Unlinked Muse");
  const wallet = privateKeyToAccount(generatePrivateKey());
  const chainId = "0x1237";
  const challenge = [
    "MUSETOOLS PAYMENT WALLET LINK",
    "version=1",
    `port_id=${portId(worker.museId, "H")}`,
    `muse_id=${worker.museId}`,
    `wallet=${wallet.address}`,
    `chain_id=${chainId}`,
    "origin=https://musetools.fun",
    "nonce=00112233445566778899aabb",
  ].join(" | ");
  const walletSignature = await wallet.signMessage({ message: challenge });
  const walletRecord = renderWalletRecord({
    address: wallet.address,
    chainId,
    challenge,
    signature: walletSignature,
  });
  const linked = await call("POST", ["wallet-links"], await signed(worker, walletRecord));
  assert.equal(linked.status, 201);

  const wrongSigner = privateKeyToAccount(generatePrivateKey());
  const invalidChallenge = challenge
    .replace(worker.museId, unlinkedWorker.museId)
    .replace(portId(worker.museId, "H"), portId(unlinkedWorker.museId, "H"));
  const invalidWalletRecord = renderWalletRecord({
    address: wallet.address,
    chainId,
    challenge: invalidChallenge,
    signature: await wrongSigner.signMessage({ message: invalidChallenge }),
  });
  const invalidLink = await call("POST", ["wallet-links"], await signed(unlinkedWorker, invalidWalletRecord));
  assert.equal(invalidLink.status, 401);
  assert.equal(invalidLink.body.error.code, "INVALID_WALLET_SIGNATURE");

  const taskText = renderTaskRecord({
    category: "OTHER",
    executor: "agent",
    title: "Audit the public connector",
    objective: "Return a concise report with reproducible findings.",
    city: "",
    area: "",
    reward: "25",
    asset: "USDC",
    duration: "2 hours",
    deadline: "2030-09-26T10:00:00.000Z",
    clearance: "H1",
    proof: [{ type: "OUTPUT", description: "Public report URL" }],
  });
  const created = await call("POST", ["tasks"], await signed(creator, taskText));
  assert.equal(created.status, 201);
  const taskId = Number(created.body.taskId);
  assert.ok(taskId > 0);

  const snapshot = await call("GET", ["tasks"], undefined, { limit: "50" });
  const task = snapshot.body.tasks.find((item: PortTask) => item.id === taskId) as PortTask;
  assert.ok(task);

  const unpayableClaim = await call(
    "POST",
    ["events"],
    await signed(unlinkedWorker, renderAcceptRecord(task), taskId),
    { task: String(taskId) },
  );
  assert.equal(unpayableClaim.status, 409);
  assert.equal(unpayableClaim.body.error.code, "PAYMENT_DESTINATION_REQUIRED");

  const claimed = await call(
    "POST",
    ["events"],
    await signed(worker, renderAcceptRecord(task), taskId),
    { task: String(taskId) },
  );
  assert.equal(claimed.status, 201);

  const workerActor: PortActor = { museId: worker.museId, name: worker.name };
  const assigned = await call(
    "POST",
    ["events"],
    await signed(creator, renderAssignRecord(task, workerActor), taskId),
    { task: String(taskId) },
  );
  assert.equal(assigned.status, 201);

  const firstProof = await call(
    "POST",
    ["events"],
    await signed(worker, renderProofRecord(task, [{ type: "OUTPUT", value: "https://example.com/report-v1" }]), taskId),
    { task: String(taskId) },
  );
  assert.equal(firstProof.status, 201);

  const changes = await call(
    "POST",
    ["events"],
    await signed(creator, renderVerifyRecord(task, "reviewing", "Add reproduction steps."), taskId),
    { task: String(taskId) },
  );
  assert.equal(changes.status, 201);

  const revisedProof = await call(
    "POST",
    ["events"],
    await signed(worker, renderProofRecord(task, [{ type: "OUTPUT", value: "https://example.com/report-v2" }]), taskId),
    { task: String(taskId) },
  );
  assert.equal(revisedProof.status, 201);

  const accepted = await call(
    "POST",
    ["events"],
    await signed(creator, renderVerifyRecord(task, "accepted", "Verified."), taskId),
    { task: String(taskId) },
  );
  assert.equal(accepted.status, 201);

  const underpayment = await call(
    "POST",
    ["events"],
    await signed(creator, renderSettleRecord(task, {
      amount: "10",
      asset: "USDC",
      rail: "Robinhood Chain",
      tx: "0xunderpayment",
      recipient: wallet.address,
    }), taskId),
    { task: String(taskId) },
  );
  assert.equal(underpayment.status, 422);
  assert.equal(underpayment.body.error.code, "PAYMENT_TERMS_MISMATCH");

  const paid = await call(
    "POST",
    ["events"],
    await signed(creator, renderSettleRecord(task, {
      amount: "25",
      asset: "USDC",
      rail: "Robinhood Chain",
      tx: "0xrealreceipt",
      recipient: wallet.address,
    }), taskId),
    { task: String(taskId) },
  );
  assert.equal(paid.status, 201);

  const finalSnapshot = await call("GET", ["tasks"], undefined, { limit: "50" });
  const settled = finalSnapshot.body.tasks.find((item: PortTask) => item.id === taskId) as PortTask;
  assert.equal(settled.state, "SETTLED");
  assert.equal(settled.proof?.items[0]?.value, "https://example.com/report-v2");
  assert.equal(settled.settlement?.amount, 25);
  assert.equal(settled.settlement?.asset, "USDC");
  assert.equal(settled.settlement?.recipient.toLowerCase(), wallet.address.toLowerCase());
});
