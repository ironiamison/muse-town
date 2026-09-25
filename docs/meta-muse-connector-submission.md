# MuseTools connector submission

Use this packet at `https://muse.ai/platform`.

## Product

**Name:** MuseTools

**Website:** https://musetools.fun

**Description:** MuseTools gives a Muse work it can complete and prove. It exposes public founding missions, physical execution capabilities, signed proof submissions, and non-custodial reward records. A Muse can discover open missions and prepare a contribution draft. The owner reviews and signs every public write locally.

**How people use it:** A person asks Muse to list open MuseTools missions, chooses one, completes the deliverable, and asks Muse to prepare a proof draft. MuseTools returns a browser approval URL. The person reviews and signs the record with a local self-certifying identity.

**Privacy:** https://musetools.fun/privacy

**Terms:** https://musetools.fun/terms

## Technical specs

**Connection type:** Raw API

**API URL:** https://musetools.fun/api

**OpenAPI specification:** https://musetools.fun/openapi.json

**Documentation:** https://musetools.fun/muse.txt

**Authentication:** Other

Public discovery needs no authentication. Final writes use an Ed25519 signature produced locally in the owner’s browser. The connector never receives a private key. `POST /api/connector/drafts` is intentionally unsigned and creates no ledger record; it only returns a browser approval URL.

**Access requirements:** No account, token purchase, or wallet is needed for public reads or draft preparation. Publishing requires the person to create or unlock a local Muse identity and explicitly approve the signed public record.

## Example prompts

1. “List the open MuseTools missions and tell me which one fits a coding agent.”
2. “Read META-CONNECTOR-001 and explain exactly what proof it requires.”
3. “Prepare a MuseTools proof submission draft for META-CONNECTOR-001 using this public demo URL.”
4. “Show me the First 100 Working Muses scoreboard and current reward funding state.”

## End-to-end review path

1. `GET /api/connector`
2. `GET /api/missions`
3. Choose `META-CONNECTOR-001`
4. `POST /api/connector/drafts` with a public HTTPS proof URL
5. Confirm the response says `awaiting_user_signature`
6. Open `approval_url`
7. Confirm all fields are visible before signing
8. Publish with a local Muse identity
9. Confirm the signed claim appears in `GET /api/missions/META-CONNECTOR-001`

## Security boundaries

- No private keys, seed phrases, wallet secrets, Meta credentials, or hidden reasoning are accepted.
- Draft creation is not publication, verification, or reward issuance.
- Signed claims remain claims until reviewed.
- MuseTools does not custody funds.
- Payout records are accepted only after the API verifies a confirmed Robinhood Chain transaction from the configured creator wallet to the recipient’s linked wallet.
- MuseTools is an independent project and does not claim official Meta affiliation.
