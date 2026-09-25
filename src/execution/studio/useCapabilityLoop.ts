import { useCallback, useEffect, useMemo, useReducer } from "react";
import { FLAGSHIP, LOOP_ORDER, STAGE_DURATION, type LoopStage } from "../../demo/flagship";
import { CONTINUATION_BY_ID, type Continuation, type PowerId } from "../../lib/powers";

export type LoopState = {
  stage: LoopStage;
  power: PowerId | null;
  continuationId: string | null;
  intent: string;
  /** Media stays on screen only while the physical world is attached. */
  realityOpen: boolean;
};

type Action =
  | { type: "reset" }
  | { type: "power"; power: PowerId }
  | { type: "continuation"; id: string }
  | { type: "intent"; intent: string }
  | { type: "send" }
  | { type: "advance" }
  | { type: "replay" };

const initial: LoopState = {
  stage: "idle",
  power: null,
  continuationId: null,
  intent: "",
  realityOpen: false,
};

function defaultIntent(continuation: Continuation | null) {
  if (!continuation) return "";
  if (continuation.flagship) return FLAGSHIP.intent;
  return continuation.draft?.title ?? "";
}

function next(stage: LoopStage): LoopStage {
  const index = LOOP_ORDER.indexOf(stage);
  return LOOP_ORDER[Math.min(index + 1, LOOP_ORDER.length - 1)];
}

function reducer(state: LoopState, action: Action): LoopState {
  switch (action.type) {
    case "reset":
      return initial;
    case "power":
      if (state.power === action.power && state.stage === "power") return initial;
      return { ...initial, stage: "power", power: action.power };
    case "continuation": {
      const continuation = CONTINUATION_BY_ID.get(action.id) ?? null;
      if (!continuation) return state;
      return {
        stage: "continuation",
        power: continuation.power,
        continuationId: continuation.id,
        intent: defaultIntent(continuation),
        realityOpen: false,
      };
    }
    case "intent":
      return { ...state, intent: action.intent, stage: state.stage === "continuation" ? "intent" : state.stage };
    case "send": {
      // Only the flagship example plays. Other continuations go to the real composer.
      const continuation = state.continuationId ? CONTINUATION_BY_ID.get(state.continuationId) : null;
      if (!continuation?.flagship) return state;
      return { ...state, stage: "matching" };
    }
    case "advance": {
      const stage = next(state.stage);
      return {
        ...state,
        stage,
        realityOpen: stage === "executing" || stage === "proof",
      };
    }
    case "replay":
      return { ...state, stage: "matching", realityOpen: false };
    default:
      return state;
  }
}

export function useCapabilityLoop() {
  const [state, dispatch] = useReducer(reducer, initial);
  const continuation = useMemo(
    () => (state.continuationId ? CONTINUATION_BY_ID.get(state.continuationId) ?? null : null),
    [state.continuationId],
  );
  const flagship = Boolean(continuation?.flagship);
  const playing = ["matching", "accepted", "executing", "proof"].includes(state.stage);

  // Automatic playback only for the flagship example. Other continuations stop
  // at the contract step so nothing is shown that the network cannot deliver.
  useEffect(() => {
    if (!playing || !flagship) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = STAGE_DURATION[state.stage] ?? 1200;
    const timer = window.setTimeout(() => dispatch({ type: "advance" }), reduced ? Math.min(duration, 900) : duration);
    return () => window.clearTimeout(timer);
  }, [flagship, playing, state.stage]);

  const selectPower = useCallback((power: PowerId) => dispatch({ type: "power", power }), []);
  const selectContinuation = useCallback((id: string) => dispatch({ type: "continuation", id }), []);
  const setIntent = useCallback((intent: string) => dispatch({ type: "intent", intent }), []);
  const send = useCallback(() => dispatch({ type: "send" }), []);
  const replay = useCallback(() => dispatch({ type: "replay" }), []);
  const reset = useCallback(() => dispatch({ type: "reset" }), []);

  return {
    state,
    continuation,
    flagship,
    playing,
    selectPower,
    selectContinuation,
    setIntent,
    send,
    replay,
    reset,
  };
}

export type CapabilityLoop = ReturnType<typeof useCapabilityLoop>;
