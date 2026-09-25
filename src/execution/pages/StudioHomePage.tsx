import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Execution } from "../../lib/execution";
import type { MuseState } from "../../lib/muse-state";
import type { TaskDraft } from "../../lib/port";
import type { MuseSkill } from "../../lib/skills";
import FoundingCohortVisual from "../components/FoundingCohortVisual";
import CapabilityLoop from "../studio/CapabilityLoop";
import EcosystemActivity from "../studio/EcosystemActivity";
import MusePresence from "../studio/MusePresence";
import PowerSentence from "../studio/PowerSentence";
import { useCapabilityLoop } from "../studio/useCapabilityLoop";
import { Link } from "../router";

export default function StudioHomePage({
  museState,
  executions,
  skills,
  networkState,
  publishedHumans,
  foundingCount,
  onConnect,
  onPublish,
}: {
  museState: MuseState;
  executions: Execution[];
  skills: MuseSkill[];
  networkState: string;
  publishedHumans: number;
  foundingCount: number;
  onConnect: () => void;
  onPublish: (draft: Partial<TaskDraft>) => void;
}) {
  const loop = useCapabilityLoop();
  const studioRef = useRef<HTMLElement>(null);

  const pick = (continuationId: string) => {
    loop.selectContinuation(continuationId);
    studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // When the example finishes, make sure the proof is in view on small screens.
  useEffect(() => {
    if (loop.state.stage !== "returned") return;
    const target = document.querySelector<HTMLElement>(".ms-findings");
    if (target && window.innerWidth < 900) target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [loop.state.stage]);

  return (
    <main className="ms-home" data-stage={loop.state.stage}>
      <section className="ms-studio ms-shell" ref={studioRef} aria-label="Muse capability studio">
        <div className="ms-studio__lead">
          <span className="ms-eyebrow">MuseTools</span>
          <h1>More powers for your Muse.</h1>
          <p>
            Your Muse already browses, connects apps, and buys online. MuseTools gives it the rest: being somewhere, witnessing, taking custody, verifying at the source, calling specialists, and settling — each returned as signed proof.
          </p>
        </div>

        <div className="ms-studio__grid">
          <MusePresence
            state={museState}
            stage={loop.state.stage}
            selectedPower={loop.state.power}
            onConnect={onConnect}
            onGiveSomethingNew={() => {
              loop.reset();
              document.querySelector<HTMLButtonElement>(".ms-verb")?.focus();
            }}
          />
          <div className="ms-studio__work">
            <PowerSentence loop={loop} museState={museState} onPublish={onPublish} />
            <CapabilityLoop loop={loop} museState={museState} onPublish={onPublish} />
          </div>
        </div>
      </section>

      <EcosystemActivity
        executions={executions}
        skills={skills}
        networkState={networkState}
        publishedHumans={publishedHumans}
        onPick={pick}
      />

      <section className="ms-founding-callout">
        <div className="ms-shell">
          <div className="ms-founding-callout__copy">
            <span className="ms-eyebrow fm-eyebrow"><b>FM</b> Public launch cohort</span>
            <h2>The First 100 Working Muses.</h2>
            <p>Claim a permanent founding number, prove useful work, and help build the execution layer for Muses.</p>
            <Link href="/muses" className="ms-button ms-button--signal">
              Enter the First 100 <ArrowRight />
            </Link>
          </div>
          <FoundingCohortVisual
            className="ms-founding-callout__visual"
            compact
            count={foundingCount}
          />
        </div>
      </section>
    </main>
  );
}
