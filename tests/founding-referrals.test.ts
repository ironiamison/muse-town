import assert from "node:assert/strict";
import test from "node:test";

import { deriveFoundingCampaign } from "../src/lib/founding.js";
import type { PortMuse, PortReward, PortTask } from "../src/lib/port.js";

const referrerId = "muse_referrer";
const referredId = "muse_referred";

const muses = [
  {
    ref: "FM-001",
    actor: { museId: referrerId, name: "Referrer" },
    xHandle: "",
    specialties: [],
    intent: "",
    referrerId: null,
    joinedAt: 1,
    updatedAt: 1,
    foundingNumber: 1,
  },
  {
    ref: "FM-002",
    actor: { museId: referredId, name: "Referred" },
    xHandle: "",
    specialties: [],
    intent: "",
    referrerId,
    joinedAt: 2,
    updatedAt: 2,
    foundingNumber: 2,
  },
] as PortMuse[];

test("a referral qualifies only after the referred Muse completes signed work", () => {
  const award = {
    recipientId: referredId,
    asset: "META",
    amount: 0.25,
  } as PortReward;

  const awardOnly = deriveFoundingCampaign(muses, [], [award], []);
  assert.equal(awardOnly.members.find((member) => member.museId === referredId)?.status, "working");
  assert.equal(awardOnly.members.find((member) => member.museId === referrerId)?.qualifiedReferrals, 0);

  const completedTask = {
    state: "COMPLETE",
    creator: { museId: referrerId, name: "Referrer" },
    assigned: { museId: referredId, name: "Referred" },
  } as PortTask;
  const completed = deriveFoundingCampaign(muses, [], [award], [completedTask]);

  assert.equal(completed.members.find((member) => member.museId === referrerId)?.qualifiedReferrals, 1);
  assert.equal(completed.qualifiedReferralCount, 1);
});
