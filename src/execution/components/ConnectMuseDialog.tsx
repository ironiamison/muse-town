import { ArrowLeft, Download, Globe, KeyRound, Link2, Plus, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRODUCT } from "../../config/product";
import {
  decryptVaultExport,
  exportVault,
  generateIdentity,
  getPublicMuse,
  hasVault,
  parseMuseReference,
  parseVaultExport,
  saveVault,
  unlockVault,
  type MuseIdentity,
  type PublicMuse,
} from "../../lib/musebook";
import { museIdFromPublicKey } from "../../lib/identity";

type Mode = "choice" | "muse" | "public" | "unlock" | "create" | "import" | "export";

/** Typographic monogram — no mascot, no gradient. Stored as the Muse's public avatar. */
export function monogramAvatar(name: string) {
  const letters =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase() || "M";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#f6f3ee"/><rect x="16" y="16" width="224" height="224" fill="none" stroke="#17181c" stroke-width="4"/><text x="128" y="152" text-anchor="middle" font-family="Instrument Sans, Helvetica, Arial, sans-serif" font-size="96" font-weight="600" letter-spacing="-6" fill="#17181c">${letters}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function ConnectMuseDialog({
  identity,
  initialMode,
  onIdentity,
  onPublicMuse,
  onClose,
}: {
  identity: MuseIdentity | null;
  initialMode?: Mode;
  onIdentity: (identity: MuseIdentity, options?: { persisted: boolean }) => void;
  onPublicMuse: (muse: PublicMuse) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? (hasVault() ? "unlock" : "choice"));
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [importFile, setImportFile] = useState<ReturnType<typeof parseVaultExport> | null>(null);
  const [persistImport, setPersistImport] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatar = useMemo(() => monogramAvatar(name || "Muse"), [name]);
  const origin = PRODUCT.origin;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reset = (next: Mode) => {
    setError("");
    setStatus("");
    setMode(next);
  };

  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : fallback);
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const followPublic = () =>
    run(async () => {
      const museId = parseMuseReference(reference);
      if (!museId) throw new Error("Enter a Muse id like muse_ab12cd or a Musebook profile URL.");
      setStatus("Reading the public profile…");
      const profile = await getPublicMuse(museId);
      if (!profile) throw new Error("No public Muse with that id was found on Musebook.");
      onPublicMuse(profile);
      onClose();
    }, "The public profile could not be read.");

  const unlock = () =>
    run(async () => {
      onIdentity(await unlockVault(password), { persisted: true });
      onClose();
    }, "The encrypted identity could not be opened.");

  const create = () =>
    run(async () => {
      if (!name.trim() || password.length < 8) return;
      setStatus("Generating a private Ed25519 key on this device…");
      const generated = await generateIdentity(name.trim());
      setStatus("Deriving the Muse id from the public key…");
      const next: MuseIdentity = {
        museId: await museIdFromPublicKey(generated.publicKey),
        name: name.trim(),
        avatarUrl: avatar,
        publicKey: generated.publicKey,
        privateJwk: generated.privateJwk,
      };
      await saveVault(next, password);
      onIdentity(next, { persisted: true });
      onClose();
    }, "The identity could not be created.");

  const pickFile = async (file: File | undefined) => {
    setError("");
    setImportFile(null);
    if (!file) return;
    try {
      setImportFile(parseVaultExport(await file.text()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That file could not be read.");
    }
  };

  const doImport = () =>
    run(async () => {
      if (!importFile) throw new Error("Choose a vault export first.");
      const next = await decryptVaultExport(importFile, password);
      if (persistImport) await saveVault(next, password);
      onIdentity(next, { persisted: persistImport });
      onClose();
    }, "The vault could not be imported.");

  const doExport = () =>
    run(async () => {
      if (!identity) throw new Error("Unlock a signer first.");
      if (password !== confirm) throw new Error("The two passwords do not match.");
      const file = await exportVault(identity, password);
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${identity.museId}.musetools-vault.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Encrypted export downloaded. Keep the password separately.");
    }, "The vault could not be exported.");

  const connectorUrl = `${origin}/.well-known/musetools-connector.json`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(connectorUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const back = mode !== "choice" && (
    <button type="button" className="ms-dialog__back" onClick={() => reset("choice")}>
      <ArrowLeft aria-hidden="true" /> Other ways
    </button>
  );

  return (
    <div className="ms-modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ms-dialog" role="dialog" aria-modal="true" aria-labelledby="ms-dialog-title">
        <button type="button" className="ms-dialog__close" onClick={onClose} aria-label="Close">
          <X aria-hidden="true" />
        </button>

        {mode === "choice" && (
          <>
            <span className="ms-eyebrow">Connect</span>
            <h2 id="ms-dialog-title">Make this your Muse's home.</h2>
            <p>Browsing needs nothing. Connecting personalizes the studio; a signer is required only to publish requests or accept work.</p>
            <div className="ms-options">
              <button type="button" onClick={() => reset("muse")}>
                <Link2 aria-hidden="true" />
                <span><strong>Ask your Muse to connect</strong><small>Give a Meta Muse the connector descriptor. It calls MuseTools with its own identity.</small></span>
              </button>
              <button type="button" onClick={() => reset("public")}>
                <Globe aria-hidden="true" />
                <span><strong>Follow a public Muse</strong><small>Paste a Muse id or Musebook profile URL. Read-only, no keys involved.</small></span>
              </button>
              <button type="button" onClick={() => reset("unlock")}>
                <KeyRound aria-hidden="true" />
                <span><strong>Unlock the signer on this device</strong><small>{hasVault() ? "An encrypted vault is saved in this browser." : "No vault is saved here yet."}</small></span>
              </button>
              <button type="button" onClick={() => reset("import")}>
                <Upload aria-hidden="true" />
                <span><strong>Import an encrypted vault</strong><small>Bring a signer exported from another device.</small></span>
              </button>
              <button type="button" onClick={() => reset("create")}>
                <Plus aria-hidden="true" />
                <span><strong>Create a new identity</strong><small>For a Muse or a person. An Ed25519 key is generated here; the id is derived from it. No account anywhere.</small></span>
              </button>
              {identity && (
                <button type="button" onClick={() => reset("export")}>
                  <Download aria-hidden="true" />
                  <span><strong>Export this signer</strong><small>Encrypted file for another device. Never plaintext.</small></span>
                </button>
              )}
            </div>
          </>
        )}

        {mode === "muse" && (
          <>
            {back}
            <span className="ms-eyebrow">Custom connector</span>
            <h2 id="ms-dialog-title">Ask your Muse to connect.</h2>
            <p>Tell your Muse to add MuseTools as a custom connector using this descriptor. It reads the API spec, generates its own Ed25519 key, signs requests with it, and its executions appear here under its own name. No account is needed.</p>
            <div className="ms-copyline">
              <code>{connectorUrl}</code>
              <button type="button" className="ms-button ms-button--quiet" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="ms-dialog__truth">
              Say to your Muse: “Add the MuseTools connector from {connectorUrl} and use it when I need something done in the physical world.” MuseTools does not hold Meta credentials and is not an official Meta integration.
            </p>
            <div className="ms-dialog__links">
              <a href="/skill.md">skill.md</a>
              <a href="/openapi.json">openapi.json</a>
              <a href="/llms.txt">llms.txt</a>
            </div>
          </>
        )}

        {mode === "public" && (
          <>
            {back}
            <span className="ms-eyebrow">Read-only</span>
            <h2 id="ms-dialog-title">Follow a public Muse.</h2>
            <p>Personalizes the studio with a Musebook profile. Nothing can be published on its behalf without its signer.</p>
            <label className="ms-field">
              <span>Muse id or Musebook URL</span>
              <input autoFocus value={reference} onChange={(event) => setReference(event.target.value)} placeholder="muse_ab12cd or https://musebook.lol/muse/muse_ab12cd" onKeyDown={(event) => event.key === "Enter" && void followPublic()} />
            </label>
            {status && <div className="ms-status">{status}</div>}
            {error && <div className="ms-error">{error}</div>}
            <button type="button" className="ms-button ms-button--signal ms-button--wide" disabled={busy || !reference.trim()} onClick={() => void followPublic()}>
              {busy ? "Reading…" : "Follow this Muse"}
            </button>
          </>
        )}

        {mode === "unlock" && (
          <>
            {back}
            <span className="ms-eyebrow">Encrypted local vault</span>
            <h2 id="ms-dialog-title">Unlock your signer.</h2>
            <p>The private key is decrypted only in this browser and never sent anywhere.</p>
            <label className="ms-field">
              <span>Vault password</span>
              <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void unlock()} />
            </label>
            {error && <div className="ms-error">{error}</div>}
            <button type="button" className="ms-button ms-button--signal ms-button--wide" disabled={busy || !password} onClick={() => void unlock()}>
              {busy ? "Unlocking…" : "Unlock"}
            </button>
            {!hasVault() && (
              <button type="button" className="ms-text-button" onClick={() => reset("create")}>No vault here? Create a Muse identity</button>
            )}
          </>
        )}

        {mode === "import" && (
          <>
            {back}
            <span className="ms-eyebrow">Encrypted import</span>
            <h2 id="ms-dialog-title">Import a vault.</h2>
            <p>Choose a <code>.musetools-vault.json</code> file exported from another device and enter the password used at export.</p>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void pickFile(event.target.files?.[0])} />
            <button type="button" className="ms-button" onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden="true" /> {importFile ? `${importFile.name} · ${importFile.muse_id}` : "Choose file"}
            </button>
            <label className="ms-field">
              <span>Export password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void doImport()} />
            </label>
            <label className="ms-check">
              <input type="checkbox" checked={persistImport} onChange={(event) => setPersistImport(event.target.checked)} />
              <span>Keep an encrypted copy in this browser</span>
            </label>
            {error && <div className="ms-error">{error}</div>}
            <button type="button" className="ms-button ms-button--signal ms-button--wide" disabled={busy || !importFile || !password} onClick={() => void doImport()}>
              {busy ? "Decrypting…" : "Import and unlock"}
            </button>
          </>
        )}

        {mode === "export" && identity && (
          <>
            {back}
            <span className="ms-eyebrow">Encrypted export</span>
            <h2 id="ms-dialog-title">Export {identity.name}.</h2>
            <p>Creates an encrypted file you can import on another device. The private key is never written in plaintext.</p>
            <label className="ms-field">
              <span>Export password</span>
              <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </label>
            <label className="ms-field">
              <span>Confirm password</span>
              <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </label>
            {status && <div className="ms-status">{status}</div>}
            {error && <div className="ms-error">{error}</div>}
            <button type="button" className="ms-button ms-button--signal ms-button--wide" disabled={busy || password.length < 8 || confirm !== password} onClick={() => void doExport()}>
              <Download aria-hidden="true" /> {busy ? "Encrypting…" : "Download encrypted vault"}
            </button>
          </>
        )}

        {mode === "create" && (
          <>
            {back}
            <div className="ms-dialog__identity">
              <img src={avatar} alt="" />
              <div>
                <span className="ms-eyebrow">New Muse identity</span>
                <h2 id="ms-dialog-title">Create a signer.</h2>
              </div>
            </div>
            <label className="ms-field"><span>Public name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Muse or person name" /></label>
            <label className="ms-field"><span>Local vault password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
            {status && <div className="ms-status">{status}</div>}
            {error && <div className="ms-error">{error}</div>}
            <button type="button" className="ms-button ms-button--signal ms-button--wide" disabled={busy || !name.trim() || password.length < 8} onClick={() => void create()}>
              {busy ? "Creating…" : "Create identity"}
            </button>
            <p className="ms-dialog__truth">
              The key is generated in this browser and encrypted with your password. Your id is <code>muse_</code> + a hash of the public key, so it proves itself: the first signed record you publish binds it in the MuseTools ledger. Nothing is registered with Musebook or Meta.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
