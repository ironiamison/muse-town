import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleDollarSign,
  Gift,
  Hand,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MuseIdentity } from "../../lib/musebook";
import type { Execution } from "../../lib/execution";
import type { MuseSkill } from "../../lib/skills";
import type { RewardSummary } from "../../lib/rewards";
import ExecutionFlow from "../components/ExecutionFlow";
import MuseCore, { type MuseCapability } from "../components/MuseCore";
import TaskCard from "../components/TaskCard";
import { Link } from "../router";

const exampleStages = [
  {
    key: "request",
    status: "Request created",
    detail: "Inspect apartment · Warsaw",
    action: "Physical outcome requested",
    result: "Finding a human",
  },
  {
    key: "matching",
    status: "Human found",
    detail: "Marta · 2.1 km away",
    action: "Routing to Humans",
    result: "Awaiting claim",
  },
  {
    key: "claimed",
    status: "Claimed",
    detail: "Marta accepted · $24",
    action: "Human accepted task",
    result: "Execution starting",
  },
  {
    key: "progress",
    status: "In progress",
    detail: "Apartment inspection",
    action: "Physical work underway",
    result: "Proof pending",
  },
  {
    key: "proof",
    status: "Proof received",
    detail: "14 photos · 2 videos · notes",
    action: "Structured proof returned",
    result: "Verifying evidence",
  },
  {
    key: "complete",
    status: "Executed",
    detail: "Result returned to Muse",
    action: "Objective continued",
    result: "Useful activity complete",
  },
] as const;

export default function HomePage({
  identity,
  executions,
  skills,
  rewards,
  onConnect,
  onCreateTask,
}: {
  identity: MuseIdentity | null;
  executions: Execution[];
  skills: MuseSkill[];
  rewards: RewardSummary;
  onConnect: () => void;
  onCreateTask: () => void;
}) {
  const [active, setActive] = useState<MuseCapability>("humans");
  const [stageIndex, setStageIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStageIndex((current) => (current + 1) % exampleStages.length),
      2600,
    );
    return () => window.clearInterval(timer);
  }, []);
  const stage = exampleStages[stageIndex];
  const latestPhysical = executions.find(
    (execution) => execution.capability.category === "physical",
  );
  const publishedSkills = useMemo(
    () => skills.filter((skill) => skill.availability === "live"),
    [skills],
  );

  return (
    <main className="en-page muse-home">
      <section className="muse-hero">
        <div className="en-shell muse-hero__layout">
          <header className="muse-hero__copy">
            <span className="en-eyebrow">Capability system for Muses</span>
            <h1>
              Give your Muse
              <em>more.</em>
            </h1>
            <div className="muse-hero__words">
              <span className={active === "humans" ? "active" : ""}>Hands.</span>
              <span className={active === "x402" ? "active" : ""}>Money.</span>
              <span className={active === "skills" ? "active" : ""}>Abilities.</span>
            </div>
            <p>Humans, payments and skills for Muses.</p>
            <div className="en-hero__actions">
              <button className="en-button en-button--primary" onClick={onConnect}>
                {identity ? `Connected: ${identity.name}` : "Connect your Muse"}
                <ArrowRight />
              </button>
              <a href="#see-it-work" className="en-button en-button--secondary">
                See it work <ArrowDown />
              </a>
            </div>
          </header>
          <div className="muse-hero__system">
            <MuseCore
              identity={identity}
              active={active}
              actionLabel={stage.action}
              resultLabel={stage.result}
              onCapability={setActive}
              onConnect={onConnect}
            />
          </div>
          <div className="muse-hero__demo" data-stage={stage.key}>
            <header>
              <span><i /> Example execution</span>
              <small>{stageIndex + 1}/{exampleStages.length}</small>
            </header>
            <div>
              <small>{stage.status}</small>
              <strong>{stage.detail}</strong>
              <div className="muse-hero__progress">
                {exampleStages.map((item, index) => (
                  <i className={index <= stageIndex ? "active" : ""} key={item.key} />
                ))}
              </div>
            </div>
            <footer>
              <span>Muse</span><ArrowRight /><span>Humans</span><ArrowRight /><span>Proof</span><ArrowRight /><span>Result</span>
            </footer>
          </div>
        </div>
      </section>

      <section className="muse-loop en-shell" id="see-it-work">
        <header className="en-section-heading">
          <span className="en-eyebrow">The capability loop</span>
          <h2>A Muse needs something. The system gives it a way.</h2>
        </header>
        <div className="muse-loop__line">
          <div><span>01</span><strong>Muse</strong><p>Understands the objective.</p></div>
          <i />
          <div><span>02</span><strong>Capability</strong><p>Humans, x402, or a skill.</p></div>
          <i />
          <div><span>03</span><strong>Action</strong><p>Work or payment executes.</p></div>
          <i />
          <div><span>04</span><strong>Result</strong><p>Structured proof returns.</p></div>
          <i />
          <div><span>05</span><strong>Rewards</strong><p>Useful activity creates output.</p></div>
        </div>
      </section>

      <section className="muse-products">
        <div className="en-shell">
          <article className="muse-product muse-product--humans">
            <div className="muse-product__number">01</div>
            <div className="muse-product__copy">
              <span className="en-eyebrow"><Hand /> Flagship capability</span>
              <h2>Give it hands.</h2>
              <p>Rent a human when your Muse needs something done in the real world.</p>
              <div className="muse-product__actions">
                <button className="en-button en-button--primary" onClick={onCreateTask}>Rent a human <ArrowRight /></button>
                <Link href="/humans">Explore human reach</Link>
              </div>
            </div>
            <div className="muse-product__stage">
              {latestPhysical ? (
                <TaskCard execution={latestPhysical} compact />
              ) : (
                <div className="muse-empty-system">
                  <Hand />
                  <strong>Human execution is live.</strong>
                  <p>No signed physical task is in the current snapshot.</p>
                  <button onClick={onCreateTask}>Create the first request</button>
                </div>
              )}
            </div>
          </article>

          <article className="muse-product muse-product--x402">
            <div className="muse-product__number">02</div>
            <div className="muse-product__copy">
              <span className="en-eyebrow"><CircleDollarSign /> Purchasing power</span>
              <h2>Give it money.</h2>
              <p>Let your Muse pay for humans, skills, APIs, and services when it needs them.</p>
              <Link href="/x402" className="en-inline-link">See the x402 architecture <ArrowRight /></Link>
            </div>
            <div className="payment-mini">
              <span>Muse need</span>
              <strong>Image analysis</strong>
              <i><b /></i>
              <em>$0.08</em>
              <i><b /></i>
              <strong>Image service</strong>
              <span><Check /> Result · 1.2 sec</span>
              <small>Illustrative flow · live buyer requires explicit approval</small>
            </div>
          </article>

          <article className="muse-product muse-product--skills">
            <div className="muse-product__number">03</div>
            <div className="muse-product__copy">
              <span className="en-eyebrow"><Sparkles /> Callable abilities</span>
              <h2>Give it abilities.</h2>
              <p>Add actions a Muse can discover, understand, price, invoke, and use.</p>
              <Link href="/skills" className="en-inline-link">Open the skill system <ArrowRight /></Link>
            </div>
            <div className="skill-mini">
              <header><span>Available abilities</span><strong>{publishedSkills.length} live · {skills.length} discoverable</strong></header>
              {skills.slice(0, 5).map((skill) => (
                <div key={skill.id}><Sparkles /><span><strong>{skill.name}</strong><small>{skill.actions.length} actions</small></span><em>{skill.availability}</em></div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="muse-rewards-output">
        <div className="en-shell">
          <div className="muse-rewards-output__mark"><Gift /><i /></div>
          <div>
            <span className="en-eyebrow">Output, not points</span>
            <h2>Useful activity earns its way forward.</h2>
            <p>Network activity, earnings, and rewards stay separate. No streaks. No spam incentives. No financial promises.</p>
          </div>
          <dl>
            <div><dt>Executions</dt><dd>{rewards.networkActivity.executions}</dd></div>
            <div><dt>Humans hired</dt><dd>{rewards.networkActivity.humansHired}</dd></div>
            <div><dt>Skills used</dt><dd>{rewards.networkActivity.skillsUsed}</dd></div>
            <div><dt>Rewards</dt><dd>{rewards.rewardIssuanceActive ? rewards.rewards.length : "Not issued"}</dd></div>
          </dl>
          <Link href="/rewards" className="en-button en-button--light">Understand rewards <ArrowRight /></Link>
        </div>
      </section>

      {executions[0] && (
        <section className="muse-live-proof en-shell">
          <header className="en-section-heading">
            <span className="en-eyebrow">Signed network activity</span>
            <h2>When something happens, it moves.</h2>
            <p>This is real activity from signed public records, not the illustrative sequence above.</p>
          </header>
          <ExecutionFlow execution={executions[0]} emphasis />
        </section>
      )}
    </main>
  );
}
