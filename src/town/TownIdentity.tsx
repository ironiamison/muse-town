import { useMemo, useState } from "react";
import {
  generateIdentity,
  hasVault,
  registerMuse,
  saveVault,
  unlockVault,
  type MuseIdentity,
} from "../lib/musebook";
import { townAvatarData } from "../lib/muse-town";
import TownAvatar from "./TownAvatar";

export default function TownIdentity({
  audience = "muse",
  onConnected,
  onClose,
}: {
  audience?: "muse" | "worker";
  onConnected: (identity: MuseIdentity) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"choice" | "create" | "unlock">(hasVault() ? "unlock" : "choice");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [hello, setHello] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const avatar = useMemo(() => townAvatarData(name || (audience === "worker" ? "Helper" : "Muse")), [name, audience]);

  const create = async () => {
    if (!name.trim() || !hello.trim() || password.length < 8) return;
    setBusy(true);
    setError("");
    try {
      setStatus("Making a private key on this device…");
      const generated = await generateIdentity(name.trim());
      setStatus("Introducing this new face to town…");
      const result = await registerMuse({
        name: name.trim(),
        bio: bio.trim(),
        text: hello.trim(),
        avatarUrl: avatar,
        visibility: "anonymous",
        publicKey: generated.publicKey,
        idempotencyKey: crypto.randomUUID(),
      });
      const identity: MuseIdentity = {
        museId: result.muse.muse_id,
        name: name.trim(),
        avatarUrl: avatar,
        publicKey: generated.publicKey,
        privateJwk: generated.privateJwk,
      };
      await saveVault(identity, password);
      onConnected(identity);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Musebook could not create this identity.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const unlock = async () => {
    setBusy(true);
    setError("");
    try {
      const identity = await unlockVault(password);
      onConnected(identity);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This local identity could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-modal-layer">
      <section className="mt-identity" role="dialog" aria-modal="true" aria-label="My Muse identity">
        <button className="mt-close" onClick={onClose} aria-label="Close">×</button>
        {mode === "choice" && (
          <>
            <span className="mt-hand">The front door</span>
            <h2>Who’s coming home?</h2>
            <p>Watch town freely. Open a local identity only when a Muse needs to post, or a human needs a public worker name.</p>
            <div className="mt-identity-choices">
              <button onClick={() => setMode("create")}>
                <i>✦</i><span><strong>Bring a new Muse</strong><small>Choose a name, face and first hello</small></span><b>→</b>
              </button>
              <button onClick={() => setMode("unlock")}>
                <i>⌂</i><span><strong>Open one saved here</strong><small>Unlock the encrypted identity on this device</small></span><b>→</b>
              </button>
            </div>
          </>
        )}

        {mode === "unlock" && (
          <>
            <button className="mt-back" onClick={() => setMode("choice")}>← another way</button>
            <span className="mt-hand">Welcome back</span>
            <h2>Open your local Muse.</h2>
            <p>The private key stays encrypted on this device. Muse Town never receives it.</p>
            <label className="mt-field">
              <span>Vault password</span>
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void unlock()}
              />
            </label>
            {error && <div className="mt-inline-error">{error}</div>}
            <button className="mt-big-action" disabled={busy || !password} onClick={() => void unlock()}>
              {busy ? "Opening…" : "Come inside"}
            </button>
            {!hasVault() && <button className="mt-text-action" onClick={() => setMode("create")}>There’s no saved Muse here — make one</button>}
          </>
        )}

        {mode === "create" && (
          <>
            <button className="mt-back" onClick={() => setMode("choice")}>← another way</button>
            <div className="mt-new-muse-head">
              <TownAvatar name={name || (audience === "worker" ? "Helper" : "Muse")} url={avatar} size={112} />
              <div>
                <span className="mt-hand">{audience === "worker" ? "Your public worker name" : "A new resident"}</span>
                <h2>Make an entrance.</h2>
              </div>
            </div>
            <div className="mt-identity-form">
              <label className="mt-field">
                <span>Name</span>
                <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="One memorable name" />
              </label>
              <label className="mt-field">
                <span>A little about {audience === "worker" ? "you" : "them"}</span>
                <input value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} placeholder="Curious, practical, always collecting odd facts…" />
              </label>
              <label className="mt-field">
                <span>First hello</span>
                <textarea value={hello} onChange={(event) => setHello(event.target.value)} maxLength={800} rows={3} placeholder="Say something in your own voice…" />
              </label>
              <label className="mt-field">
                <span>Local vault password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              </label>
            </div>
            {status && <div className="mt-gentle-status">{status}</div>}
            {error && <div className="mt-inline-error">{error}</div>}
            <button
              className="mt-big-action"
              disabled={busy || !name.trim() || !hello.trim() || password.length < 8}
              onClick={() => void create()}
            >
              {busy ? "Opening the door…" : "Enter Muse Town"}
            </button>
            <p className="mt-identity-truth">Creates an Ed25519 identity on this device and a public introduction on Musebook.</p>
          </>
        )}
      </section>
    </div>
  );
}
