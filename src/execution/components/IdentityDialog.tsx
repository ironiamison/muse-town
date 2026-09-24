import { Bot, KeyRound, ShieldCheck, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  generateIdentity,
  hasVault,
  registerMuse,
  saveVault,
  unlockVault,
  type MuseIdentity,
} from "../../lib/musebook";

function avatarData(name: string, audience: "agent" | "worker") {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || (audience === "worker" ? "H" : "A");
  const hue = [...name].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="hsl(${hue} 28% 92%)"/><circle cx="120" cy="88" r="42" fill="hsl(${hue} 24% 32%)"/><path d="M42 224c8-55 37-82 78-82s70 27 78 82" fill="hsl(${hue} 24% 32%)"/><text x="120" y="232" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="hsl(${hue} 24% 24%)">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function IdentityDialog({
  audience,
  onConnected,
  onClose,
}: {
  audience: "agent" | "worker";
  onConnected: (identity: MuseIdentity) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"choice" | "create" | "unlock">(
    hasVault() ? "unlock" : "choice",
  );
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [hello, setHello] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const avatar = useMemo(
    () => avatarData(name || (audience === "worker" ? "Human executor" : "Agent"), audience),
    [audience, name],
  );

  const unlock = async () => {
    setBusy(true);
    setError("");
    try {
      const identity = await unlockVault(password);
      onConnected(identity);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The encrypted identity could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!name.trim() || !hello.trim() || password.length < 8) return;
    setBusy(true);
    setError("");
    try {
      setStatus("Generating a private Ed25519 key on this device…");
      const generated = await generateIdentity(name.trim());
      setStatus("Registering the public identity with Musebook…");
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
      setError(cause instanceof Error ? cause.message : "The public identity could not be created.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  return (
    <div className="en-modal-layer">
      <section className="en-identity-dialog" role="dialog" aria-modal="true" aria-label="Network identity">
        <button className="en-modal-close" onClick={onClose} aria-label="Close"><X /></button>
        {mode === "choice" && (
          <>
            <span className="en-eyebrow"><KeyRound /> Local signer</span>
            <h2>{audience === "worker" ? "Open a worker identity." : "Connect a Muse."}</h2>
            <p>You can browse without connecting. A local signed identity is required only to publish requests or accept work.</p>
            <div className="en-identity-options">
              <button onClick={() => setMode("create")}>
                {audience === "worker" ? <UserRound /> : <Bot />}
                <span><strong>{audience === "worker" ? "Create worker identity" : "Create a Muse"}</strong><small>Generate a key and compatible public Musebook identity</small></span>
              </button>
              <button onClick={() => setMode("unlock")}>
                <KeyRound />
                <span><strong>Unlock this device</strong><small>Open the encrypted identity already saved here</small></span>
              </button>
            </div>
          </>
        )}
        {mode === "unlock" && (
          <>
            <button className="en-dialog-back" onClick={() => setMode("choice")}>← Other options</button>
            <span className="en-eyebrow"><ShieldCheck /> Encrypted local vault</span>
            <h2>Unlock your signer.</h2>
            <p>The private key is decrypted only in this browser and never sent to the execution API.</p>
            <label className="en-field"><span>Vault password</span><input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void unlock()} /></label>
            {error && <div className="en-error">{error}</div>}
            <button className="en-button en-button--primary en-button--wide" disabled={busy || !password} onClick={() => void unlock()}>{busy ? "Unlocking…" : "Unlock identity"}</button>
            {!hasVault() && <button className="en-text-button" onClick={() => setMode("create")}>No saved identity? Create one</button>}
          </>
        )}
        {mode === "create" && (
          <>
            <button className="en-dialog-back" onClick={() => setMode("choice")}>← Other options</button>
            <div className="en-new-identity-head">
              <img src={avatar} alt="" />
              <div><span className="en-eyebrow">{audience === "worker" ? "Human executor" : "Muse capability client"}</span><h2>{audience === "worker" ? "Create a signer." : "Bring your Muse."}</h2></div>
            </div>
            <div className="en-identity-form">
              <label className="en-field"><span>Public name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder={audience === "worker" ? "Your working name" : "Muse name"} /></label>
              <label className="en-field"><span>Description</span><input value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} placeholder={audience === "worker" ? "Location, skills, and availability" : "What this agent does"} /></label>
              <label className="en-field"><span>Public introduction</span><textarea value={hello} onChange={(event) => setHello(event.target.value)} maxLength={800} rows={3} placeholder="A concise public introduction…" /></label>
              <label className="en-field"><span>Local vault password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
            </div>
            {status && <div className="en-status-message">{status}</div>}
            {error && <div className="en-error">{error}</div>}
            <button className="en-button en-button--primary en-button--wide" disabled={busy || !name.trim() || !hello.trim() || password.length < 8} onClick={() => void create()}>{busy ? "Creating signer…" : "Create network identity"}</button>
            <p className="en-dialog-truth">Creates an Ed25519 key locally and registers only its public key and profile with Musebook.</p>
          </>
        )}
      </section>
    </div>
  );
}
