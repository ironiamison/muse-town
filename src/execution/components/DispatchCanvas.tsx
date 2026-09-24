import { ArrowRight, Check, LocateFixed, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type DispatchState = "ready" | "finding" | "matched";

export default function DispatchCanvas({
  publishedHumans,
  onCreateRealTask,
}: {
  publishedHumans: number;
  onCreateRealTask: () => void;
}) {
  const [state, setState] = useState<DispatchState>("ready");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const dispatch = () => {
    setState("finding");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("matched"), 2100);
  };

  return (
    <div className={`dispatch-canvas is-${state}`}>
      <header>
        <span>Warsaw</span>
        <small>18:42 local · product demonstration</small>
      </header>
      <div className="dispatch-field" aria-label="Abstract executor reach">
        {Array.from({ length: 9 }, (_, index) => (
          <i className={`dispatch-point point-${index + 1}`} key={index} />
        ))}
        <svg viewBox="0 0 800 390" aria-hidden="true">
          <path d="M42 270C169 220 222 91 368 134s172 145 382 70" />
          <path d="M123 43c95 75 155 43 244 110s178 57 313-22" />
        </svg>
        <div className="dispatch-request">
          <small>What does your Muse need done?</small>
          <strong>Inspect a Porsche at this dealership tomorrow afternoon.</strong>
          <span>inspect_vehicle · proof: photos, video, notes</span>
        </div>
        <div className="dispatch-human">
          <span className="dispatch-human__marker"><UserRound /><i /></span>
          <div><strong>Kasia</strong><small>1.4 km · verified</small></div>
        </div>
        {state === "finding" && (
          <div className="dispatch-finding">
            <i /><span>Finding executor</span><small>Checking reach, capability, and trust</small>
          </div>
        )}
        {state === "matched" && (
          <div className="dispatch-match">
            <span><Check /></span>
            <div><small>Accepted</small><strong>Kasia</strong></div>
            <dl>
              <div><dt>Distance</dt><dd>1.4 km</dd></div>
              <div><dt>Executions</dt><dd>48</dd></div>
              <div><dt>Rating</dt><dd>4.97</dd></div>
            </dl>
            <ShieldCheck />
          </div>
        )}
      </div>
      <footer>
        <span><LocateFixed /> {publishedHumans} humans published live availability</span>
        <div>
          {state === "ready" && <button onClick={dispatch}>Dispatch demonstration <ArrowRight /></button>}
          {state === "finding" && <button disabled>Finding executor…</button>}
          {state === "matched" && <button onClick={() => setState("ready")}>Reset demonstration</button>}
          <button className="dispatch-real" onClick={onCreateRealTask}>Create real task</button>
        </div>
      </footer>
    </div>
  );
}
