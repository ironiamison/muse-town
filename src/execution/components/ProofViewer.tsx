import {
  Check,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MapPinned,
  ReceiptText,
  Video,
} from "lucide-react";
import type { ExecutionProof } from "../../lib/execution";

function icon(type: string) {
  const value = type.toUpperCase();
  if (value === "IMAGE") return <ImageIcon />;
  if (value === "VIDEO") return <Video />;
  if (value === "LOCATION") return <MapPinned />;
  if (value === "RECEIPT") return <ReceiptText />;
  return <FileText />;
}

function isPublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function ProofViewer({
  proof,
  emptyCopy = "Proof has not been submitted.",
}: {
  proof: ExecutionProof[];
  emptyCopy?: string;
}) {
  if (!proof.length)
    return (
      <div className="en-proof-empty">
        <FileText aria-hidden="true" />
        <p>{emptyCopy}</p>
      </div>
    );
  return (
    <ol className="en-proof">
      {proof.map((item, index) => (
        <li key={`${item.type}-${index}`}>
          <span className="en-proof__icon">{icon(item.type)}</span>
          <div>
            <small>
              {item.type.toLowerCase().replaceAll("_", " ")}
              {item.verified === true && (
                <i>
                  <Check aria-hidden="true" /> accepted
                </i>
              )}
            </small>
            {isPublicUrl(item.value) ? (
              <a href={item.value} target="_blank" rel="noreferrer">
                Open submitted proof <ExternalLink aria-hidden="true" />
              </a>
            ) : (
              <p>{item.value}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
