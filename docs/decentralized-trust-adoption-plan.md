# Hylo × Decentralized Trust: Adoption Plan

**Covers:** the Decentralized Trust Graph (DTG), Verifiable Trust Infrastructure (VTI), Verifiable Trust Communities (VTCs), OpenVTC, Trust Tasks, and KERI.
**Status:** Discovery draft for discussion, written 2026-11-08.
**Audience:** Hylo product, engineering and stewardship.

---

## 0. TL;DR

- **The fit is unusually good.** Hylo already models what the DTG specifies. Groups map to communities (VTCs). Group relationships and networks map to trust networks (VTNs). Hylo also has memberships, roles, invitations, join requests, agreements and track badges. The DTG standards would mostly turn data Hylo already holds into **portable, cryptographically verifiable credentials** that members carry in their own wallets.
- **The biggest gap is person-to-person trust.** Hylo has no "I know this person" edge: no friends, follows or vouches. Verifiable Relationship Credentials (VRCs), the core of the trust graph and of proof of personhood, need a new product surface.
- **The biggest strategic question is where authority lives.** OpenVTC's community service now speaks Trust Tasks for groups, join requests, vetting, roles, badges, boards, rooms, a member directory, elections and endorsements. That is most of Hylo's group feature set. Hylo can do one of four things:
  - consume credentials from it,
  - issue credentials alongside it,
  - become the human-friendly front end on top of it,
  - or rebuild itself edge-first as a fork.
- **Positioning (decided):** Hylo is an **alternative to OpenVTC** at the community layer. It aligns with OpenVTC's standards wherever possible (DIDs, DTG credentials, Trust Tasks), so that Hylo groups are VTC-compatible. Eventually Hylo should also be able to act as a **social layer on top of an OpenVTC community**. The P2P/hosted hybrid direction is explored in `docs/p2p-hylo-architecture.md`.
- **Recommendation:** stage it. Do a short discovery phase. Then build **Option A** (accept DIDs and credentials) and **Option B** (Hylo issues membership, role and badge credentials on behalf of groups). Run both with one pilot community, and keep the data model compatible with **Option C** (groups backed by real VTCs). Treat a full edge-first fork (**Option D**) as a separately funded research track.
- **KERI is complementary, not a substitute** for the community layer. It is a strong option for key management under group and organisation identifiers (stewards co-signing M-of-N, spaces delegated from their parent group, a principled path from custodial keys to self-custody) and for organisational identity (GLEIF's vLEI). Replacing the VTC/W3C-VC stack with a KERI/ACDC stack would cut Hylo off from the DTG Trust Task ecosystem (OpenVTC, Keyring, the First Person Network). Keep Hylo's identity layer **DID-method agnostic** so that KERI identifiers (`did:webs`) can be accepted wherever VTC policy allows.

---

## 1. The landscape (as of Nov 2026)

| Piece | What it is | Maturity / notes |
|---|---|---|
| **First Person Project white paper v2.0** (2026-11-03) | The umbrella vision: proof of personhood via personhood credentials and VRCs, the DTG, VTCs and VTNs, the full VTI stack, fiduciary AI. Run by the First Person Cooperative (a Colorado public-benefit LCA). | Vision document. The First Person Network targets opening patron membership (persons, VTCs, VTNs) in **H1 2027**. Pilots are under way: the Linux Foundation VTN, New Zealand, the UK, US states (SEDI), and the **Cascadia bioregion**. |
| **DTG Credentials spec** (`trustoverip.github.io/dtgwg-cred-spec`) | Seven core credential types, listed below. Data model is W3C VC 2.0 with `DataIntegrityProof`, recommended suite `eddsa-jcs-2022`. A required `issuerScope` of `pairwise`, `directed` or `public`. DIDs only; no DID method is mandated. | **Working Draft 0.6.0**, converging on 1.0. Roles are conferred by authority (VAC) and delegation (VDC) credentials, **not** by membership credentials. |
| **Trust Tasks** (`trusttasks.org`, `trustoverip/dtgwg-trust-tasks-tf`) | Transport-agnostic JSON "units of verifiable work" with JSON Schema payloads. Bindings for HTTPS, DIDComm and TSP. | **1,335 spec versions**, almost all `draft`, with frequent retire/supersede (for example `vtc/join-requests/accept` → `vtc/members/vmc`). **TypeScript SDK exists**: `@openvtc/trust-tasks` 0.28, `-proof`, `-tsp`, `-gen`. Applications pin versions with `trust-tasks.lock`. |
| **OpenVTC / VTI** (`OpenVTC/openvtc`, `OpenVTC/verifiable-trust-infrastructure`) | Rust services. The **VTA** is a key, DID and policy agent; the **VTC** is the community service (members, credentials, policy, website and admin UX). There are also CLIs and MCP servers. | Very active (~2,860 commits). Releases every 4–6 weeks. Applying to graduate to an LFDT project named "OpenVTI". The VTA Farm is dev/test only. Keyring (mobile wallet) and the browser plugin are **beta**. **No Node/TS VTC client**: Hylo would talk to it over the Trust Task HTTPS/DIDComm bindings. |
| **ToIP stack pieces** | TSP (the trust spanning protocol; v1.0 approved Oct 2026). TRQP v2.0 (trust registry queries; approved Feb 2026). | Standards are ready. Implementations are young. |
| **DTGWG interop discussion #35** | Proposes a vocabulary: 6 layers × 4 reaches (Pair, Community, Federation, Network) × 4 modes (Move, Grant, Sync, Coordinate). Each user outcome resolves to Works / Blocked: technology / Blocked: policy / Needs agreement / Indeterminate. | **Nothing decided.** It is still useful as a UX contract for Hylo: users should always know *why* something didn't work. |
| **KERI** (`keri.one`, KERI white paper v2.63) | A decentralised key management infrastructure. Self-certifying "autonomic identifiers" (AIDs), hash-chained key event logs, pre-rotation, witnesses with witness agreement (KAWA), watchers/jurors/judges for duplicity detection, delegation, ambient verifiability. No ledger required. Related ecosystem: CESR, OOBI, ACDC credentials, `did:webs`. | Core is stable (keripy 1.1.x). The **web-facing pieces are early**: KERIA 0.1.x and Signify-TS 0.1.x as of early 2026. In production for GLEIF's **vLEI**. See §5. |

### The seven DTG credentials, in Hylo terms

| Credential | Direction | Hylo meaning |
|---|---|---|
| **VMC**: membership | Pair: community → member, plus member → community (consent) | "X is a member of group G" |
| **VAC**: authority | Unilateral, can be attenuated | "X holds role/responsibility R in G" |
| **VDC**: delegation | Delegator → delegate | "This bot/AI agent/person acts for X (or for G)" |
| **VIC**: invitation | Unilateral | An invitation link or email invite |
| **VSC**: statement | Unilateral, governed predicate | Badges (track completion), vetting attestations. The **VEC** profile covers endorsements; the **VWC** profile covers witness statements. |
| **VRC**: relationship | Symmetric pair | "We know each other." **Hylo has no equivalent today.** |
| **VPC**: persona | Unilateral | "This DID is the persona I use with you or this community" |

---

## 2. Concept mapping: Hylo ↔ DTG

| Hylo today (code) | DTG / VTI concept | Relevant Trust Task families | Gap |
|---|---|---|---|
| `groups` (`api/models/Group.js`) | **VTC** (a community with its own public DID) | `vtc/community/*`, `vtc/admin/*` | Groups have no DID and no keys. |
| Spaces (`groups.parent_id`, `type='space'`) | Sub-group with its own DID, authorised by the parent | `vtc/groups/*` (create mints a group DID) | Same as above. Delegation from the parent is a natural fit for KERI delegated AIDs. |
| `group_relationships` (parent/child, peer) and `group_relationship_invites` | **VTN** membership, or nested VTCs; TRQP *delegation* vs *recognition* | `vtc/networks/*`, `vtn/*`, `vtc/auth/recognise` | Parent/child maps to delegation and peer maps to recognition, which is a clean semantic match. |
| `group_memberships` | **VMC pair** | `vtc/members/*` (`vmc`, `request-vmc`, `admit`, `renew`, `self-remove`, …) | The member-signed reciprocal VMC needs a wallet. |
| `groups_roles`, `group_memberships_group_roles`, `responsibilities` | **VAC** (the spec says roles are VACs/VDCs, not VMCs) | `vtc/roles/*`, `acl/*`, `vtc/members/role` | Hylo's responsibility model is richer than most VTC role models; a mapping is needed. |
| `group_invites`, `group_invite_links` (`granted_roles`) | **VIC** | `vtc/invitations/*` | Invite links are bearer secrets. A VIC is signed and bound to an issuer. |
| `join_requests`, join questions, agreements | Admission policy, vetting VSCs, consent | `vtc/join-requests/*` (submit, supplement, vetting, decide), `vtc/vetting/*`, `consent/*` | Hylo's join barriers (questions, agreements, prerequisite groups, required roles) are a strong admission-policy UX. Each would need a policy representation. |
| `invited_by_id`, `join_requests.processed_by_id` | Implicit vouching | `vetting/attestation`, `vtc/endorsements/*` | Data exists but is not used as trust. |
| Track `completion_role_id` (roles-as-badges) | **VSC** badge | `vtc/badges/*` (awards, holders, kudos, wall) | The most natural first credential to issue. |
| `thanks` | **VEC** (endorsement) | `vtc/endorsements/*` | Lightweight; could become opt-in endorsements. |
| *(none)* | **VRC**: peer relationship | `vrc/relationships/{propose,issue}` | **New product surface needed.** Events and in-person QR exchange are the obvious entry point. |
| Proposals and `proposal_votes` | One-member-one-vote with personhood | `vtc/elections/*`, `voting/*` (encrypted ballots, trustees) | Optional; a high-value use of personhood. |
| `users`, `linked_account` (password/google/linkedin/apple/token) | Person node, persona DIDs | `auth/authenticate`, `auth/oob/*`, `persona/*`, `did-management/*` | No key or DID columns exist anywhere. |
| Hylo **OIDC provider** (`api/services/OpenIDConnect.js`, `oidc-provider` v7) | Session authentication (the ToIP replacement for "login") | `auth/authenticate` 0.3 (delegate/VTA can authenticate), OpenID4VP | A good bridge: Hylo could emit DID claims to apps that use "Sign in with Hylo". |
| API clients, bots, Zapier | Agent node + **VDC** | `vta/*` delegation tasks | Bots would get delegated, scoped, revocable authority. |
| Murmurations profile (`MurmurationsController`) | Trust registry / directory entry | `registry/*`, `vtn/directory/*`, TRQP | Murmurations stays useful for discovery. TRQP is about authority. |
| Member directory, profiles | r-cards (JSContact), persona-scoped | `vtc/directory/*` (card, disclosure, introduce, export) | Hylo profiles are **global across groups**, which conflicts with the per-community persona model (see Q7). |
| Moderation (`flagged_items`, `moderation_actions`, `blocked_users`) | Revocation, policy enforcement | `vtc/members/admin-remove`, revocation and status | Revocation must stay in sync with moderation outcomes. |

**Takeaway.** Almost every Hylo group primitive has a DTG counterpart, and OpenVTC has already drafted Trust Tasks for most of them. The genuinely new things are VRCs, personas and wallet custody.

---

## 3. Strategic options (Decision #1)

### Option A: Relying party ("Bring your own trust")
Hylo **accepts** DIDs and verifiable presentations:
- **Sign-in:** a DID can sign in via `auth/authenticate` or OpenID4VP. It is added as a new `linked_account` provider.
- **Join gating:** a group can require a credential from an external VTC (for example "member of the LF kernel VTC" or "personhood credential from the First Person Network").
- **Cross-community recognition:** `vtc/auth/recognise` maps a foreign community's role to a local Hylo role.

*Pros:* small, low risk, Hylo's data model is unchanged. *Cons:* members get nothing portable *out* of Hylo.

### Option B: Hylo as issuer ("Hylo-hosted VTCs")
Each opted-in group gets a public DID (for example `did:webvh` hosted under hylo.com, with keys in a KMS). Hylo **issues** VMCs, VACs, VSC badges and VICs to members' wallets. The Hylo database stays the source of truth; credentials are signed attestations of that state, with status lists for revocation.

*Pros:* members and groups get portable trust, and Hylo becomes a meaningful issuer in the DTG. *Cons:* Hylo holds group keys, which is custodial. Revocation and sync add operational load.

### Option C: Hylo as front end to real VTCs
A Hylo group is **backed by an OpenVTC VTC** (self-hosted, or run by Hylo/FPC as a fiduciary service provider). Admission, membership and roles become authoritative in the VTC. Hylo provides the social and coordination layer (posts, chat, events, maps, tracks, funding rounds) and speaks Trust Tasks to the VTC over HTTPS or DIDComm.

*Pros:* true portability (a group can leave Hylo with its identity and members intact), and Hylo stays focused on its strengths. *Cons:* a large refactor of membership and role code paths, a dependency on young Rust services, and two sources of truth during migration.

### Option D: "Hylo-VTI" fork (edge-first)
A fork in which:
- keys live on members' devices (Keyring, VTAs);
- the Hylo server becomes a mediator, data room and indexer;
- posts are verifiable data structures signed by persona DIDs;
- group chat uses MLS;
- AI agents act under VDCs.

*Pros:* the full vision. *Cons:* effectively a new product, with the hardest UX problems (key recovery, multi-device, offline). It is not compatible with Hylo's current server-centric architecture.

### Recommendation
**Do A and B in stages, with one pilot community, and design the schema so that C is a configuration rather than a rewrite.** Possible pilots: a bioregional network that overlaps the Cascadia pilot, or an open-source or cooperative group already near the First Person Cooperative. Revisit C after the pilot.

**Update:** D is no longer just a separate fork. `docs/p2p-hylo-architecture.md` proposes hosted and P2P groups running **side by side in one Hylo**, sharing a single person-held identity. The Hylo server becomes, per group, the authority, a delegated peer, a blind relay, or absent.

---

## 4. Phased plan

Sizing is rough, in engineer-weeks, and assumes the current team's familiarity with the backend.

### Phase 0: Discovery and decisions (4–6 weeks, 1–2 people)

**Ecosystem:**
- Join DTGWG calls (Wednesdays). Membership requires ToIP or DIF membership.
- Contact the First Person Cooperative about VTC pilots and its fiduciary service provider plans.

**Hands-on spikes:**
- Install `openvtc` and join `first.openvtc.net`. Stand up `vta-service` and `vtc-service` locally. Use Keyring (beta) as a wallet.
- In Node, verify a VMC with `@openvtc/trust-tasks-proof`.
- Run one Trust Task round trip (`acl/grant`) over the HTTPS binding from the backend.
- Resolve a `did:webvh` and a `did:webs` (KERI) identifier from Node.

**Decisions:** answer Q1–Q8 in §6, and pick the pilot community.

**Output:** an ADR and a spec for Phase 1–2.

### Phase 1: Identity foundation (6–10 engineer-weeks)

**Schema:**
- `user_identifiers` table: `user_id`, `did`, `method`, `issuer_scope`, `group_id` (nullable, for per-group personas), `verified_at`, `revoked_at`.
- `group_identifiers` table: group DID, method, key references, rotation state.

**Auth:**
- Add a DID login strategy alongside `config/passport.js` and `SessionController`. Use the `auth/authenticate` challenge/response, or OpenID4VP.
- Add a "Connect your wallet" flow in user settings, and treat the DID as a `linked_account` provider.

**Group DIDs:** mint keys in a KMS, publish `did:webvh` logs from the backend (enable the `portable` parameter so groups can move off Hylo), and add rotation tooling.

**Crypto dependencies:** `@noble/ed25519`/`@noble/curves`, `jose`, and the `@openvtc/trust-tasks*` packages (pinned, with `trust-tasks.lock` checked in CI).

**OIDC bridge:** optionally add DID and verified-membership claims to Hylo's OIDC tokens, so downstream "Sign in with Hylo" apps benefit.

### Phase 2: Hylo issues credentials (Option B, 8–12 engineer-weeks)

Issue credentials from existing lifecycle hooks:
- **VSC badges** on track completion (`Post.js` completion-role logic). Ship this first: low stakes and highly visible.
- **VMC** when a membership is created or activated (`GroupMembership`). The reciprocal member-signed VMC is requested when the member has a wallet.
- **VAC** for roles and responsibilities (`MemberGroupRole` create/delete).
- **VIC** from invite links and email invites (`GroupInviteLink`, `Invitation`).

**Revocation:** host status lists. Revoke on leave, removal, role removal and moderation actions.

**Delivery:** OpenID4VCI to Keyring or other wallets, and DIDComm/Trust Task `credential-exchange/offer|issue` to VTAs. Also offer a downloadable credential bundle in the account export (`ExportService`).

**Steward controls:** per group, choose which credentials are issued and declare the disclosure policy. The DTG spec requires a VTC to publish whether member identifiers are disclosed.

### Phase 3: Hylo verifies credentials (Option A, 6–8 engineer-weeks)

- **New join barrier, "Present a credential":** sits alongside join questions, agreements and prerequisite groups. Settings use the same pattern as `required_roles`. Verification results map to the #35 outcomes, so users see *why* they were blocked.
- **Cross-community recognition:** `vtc/auth/recognise` maps a foreign VTC's role to a Hylo `GroupRole`, tied into `group_relationships`.
- **Personhood gates (optional, per group):** for proposal voting, funding-round allocations and anti-spam on public groups.

### Phase 4: Trust graph features (8–12 engineer-weeks plus design and research)

- **VRC ceremony:** "I've met this person" via QR at Hylo events, or a mutual confirmation in-app. Store only the user's own edges, or better, keep them only in the wallet.
- **Vouching on join requests:** existing members attest with a vetting VSC (`vetting/attestation`). This maps onto `join_requests` processing and Hylo's steward review UI.
- **Endorsements:** opt-in VECs, possibly evolving from Thanks and skills.
- **Trust signals display:** carefully scoped and privacy-preserving, with ZK proofs where available. Involve the DTGWG Harms task force (see Q8).

### Phase 5: Groups backed by VTCs (Option C, 12+ engineer-weeks; decide after the pilot)

- An adapter layer: Hylo membership and role mutations call VTC Trust Tasks, and VTC events sync back.
- `group_relationships` ↔ `vtc/networks/join`, plus VTN directory integration.
- Migration tooling: an existing Hylo group "graduates" to a VTC, and its member credentials are re-issued by the group's own VTA.

### Phase 6 (separate track): edge-first fork research
Prototype with Signify-TS or VTA browser-plugin signing for posts, MLS group chat, and data rooms.

---

## 5. KERI: how it relates, and where it could fit

### What KERI is
KERI is a decentralised key management infrastructure (from the white paper v2.63, Sam Smith):
- **Identifiers:** self-certifying *autonomic identifiers* (AIDs) bound at inception to key pairs.
- **Key history:** an append-only, hash-chained **key event log**. Rotation uses **pre-rotation**: you commit now to the digest of your next key, which survives key compromise and is post-quantum friendly.
- **Indirect mode:** **witnesses** receipt events and reach agreement via KAWA. **Watchers, jurors and judges** detect duplicity.
- **Delegation:** a parent AID can delegate a child AID, including *custodial* delegation. The delegator holds the delegate's pre-rotated keys and can revoke or re-assign signing authority without the two parties ever sharing private keys.
- **Ambient verifiability:** logs can be served by any infrastructure, and **no ledger is needed**.
- **Positioning:** the paper explicitly pitches KERI as a candidate **trust spanning layer**, the same "hourglass" framing ToIP uses for TSP.

The surrounding ecosystem (from background knowledge plus repo status in early 2026):
- CESR (encoding), OOBI (discovery), **ACDC** (chained credentials, a ToIP draft), and **`did:webs`** (a KERI AID published as a web-hosted DID; spec v0.9.x).
- Implementations: keripy (stable 1.1.x), **KERIA** (cloud agent) plus **Signify-TS** (edge signing in the browser, keys never leave the client), both early 0.1.x; keriox (Rust).
- Production use: GLEIF's **vLEI** (verifiable legal-entity identifiers).

### How it relates to DTG/VTC/OpenVTC
- **Shared lineage.** KERI and the ToIP stack co-evolved. The FPP white paper says one of the two TSP implementations is Python, inside the KERI suite. `did:webvh`, OpenVTC's durable DID method, adopted KERI ideas (self-certifying identifiers, pre-rotation).
- **The DTG spec is method-agnostic.** For durable identifiers (VTCs, long-lived member identifiers) it asks for verifiable key history, rotation and pre-rotation. It names `did:webvh` as the example and notes `did:scid` in development, and says `did:web` falls short. A KERI-backed `did:webs` plausibly meets those properties, but whether any given VTC's policy *accepts* it is an open question.
- **Credential formats diverge.** DTG credentials are W3C VC 2.0 with Data Integrity proofs. KERI's native credential format is **ACDC**, which has strong built-in chaining (authority provenance) but is not VC 2.0. Mixing the two means bridging.
- **OpenVTC uses DIDComm/TSP and `did:webvh`/`did:peer`.** In what we reviewed we saw no native KERI KEL support in OpenVTC.

### Option K1: KERI *alongside* the VTC stack (recommended to evaluate)
- **Group identifiers as multi-sig KERI AIDs.** Stewards co-control a group's identity (M-of-N thresholds), which mirrors OpenVTC's M-of-N policy approvals and Hylo's Administration responsibility. Publish them as `did:webs` on hylo.com, so the *hosting* is Hylo's but *control* is cryptographically the group's. If the group leaves Hylo, it keeps its identifier.
- **Spaces as delegated AIDs** of their parent group. This maps exactly onto Hylo's parent/space model and revocation semantics.
- **Custodial → self-custody migration path.** Hylo starts as the custodial delegator (needed for mainstream UX). Members or groups later rotate control to their own devices without changing identifiers. KERI is one of the few systems with a principled answer here.
- **Organisational identity:** accept vLEI credentials when organisations (co-ops, nonprofits, companies) join or act in Hylo groups.
- **Cost:** a second identity stack to operate (witnesses, watchers, KERIA), and an ACDC↔VC bridge for anything that must interoperate with DTG.

### Option K2: KERI *instead of* the VTC stack (not recommended for the community layer)
- *Pros:* mature, rigorous key management. Signify-TS fits a web app well. Production credibility through vLEI. Strong authority chaining via ACDC.
- *Cons:*
  - Hylo would fall outside the DTG Trust Task interop surface: OpenVTC VTCs, Keyring, the First Person Network, and Linux Foundation pilots.
  - KERI does not itself define community, membership, vetting, relationship or personhood semantics, so Hylo would have to re-invent what the DTG specs already draft.
  - Smaller developer community, steep learning curve, and the web pieces are early releases.

**Bottom line on KERI:**
- Build Hylo's identity layer to be **DID-method agnostic**: `did:webvh`, `did:webs`, `did:peer`, `did:key`.
- Speak **DTG credentials and Trust Tasks** at the interop boundary.
- Evaluate KERI specifically for **group key governance** (multi-sig, delegation, custody migration) and **organisational identity** (vLEI).
- Ask DTGWG and OpenVTC directly whether VTAs resolve and accept `did:webs`, and whether an ACDC↔VC bridge profile is planned.

---

## 6. Big questions and product decisions

### Strategy and governance
1. **Posture (A/B/C/D).** Which role does Hylo play? See §3. *Recommendation:* A and B now, C later.
2. **Source of truth.** Is membership authoritative in Hylo's database or in a VTC? This drives everything from moderation to data export.
3. **Ecosystem participation.**
   - Does Hylo join ToIP/DIF and contribute specs? Hylo's join-barrier, space and responsibility models could improve `vtc/*` tasks.
   - Does Hylo (or Hylo groups) become a First Person Cooperative patron member as a VTC or VTN?
   - Does Hylo seek certification under the First Person Governance Framework once it exists?
4. **Partner or compete with OpenVTC's VTC.** Its admin and website UX plus `boards`, `rooms`, `elections`, `badges` and `directory` overlap Hylo heavily. Being the "human-friendly VTC front end" is a real positioning opportunity, but only if Hylo commits to their task model.
5. **Business model and cost.** Who pays for key custody, VTA hosting, status lists and witnesses? Options: a premium group feature, FPC as a fiduciary service provider, or grant funding (this aligns with public-goods funders).

### Identity and custody
6. **Custody model.**
   - Custodial: Hylo holds keys. Easy, but not sovereign.
   - Bring your own wallet: Keyring or a VTA. Sovereign, but high friction.
   - Hybrid: a Hylo- or FPC-hosted VTA per user, with a migration path to self-custody (KERI delegation is the cleanest pattern).
   - Also decide: key recovery, multi-device, and what happens when a user loses a phone.
7. **Personas and correlation.** Hylo profiles are global across all of a user's groups. DTG defaults to **per-relationship or per-community identifiers** to prevent cross-community linking, with personas as *intentional* correlation. Options:
   - (a) keep the global profile and add an optional public persona DID;
   - (b) allow per-group personas (a big UX and data-model change touching profiles, the member directory, messaging and search);
   - (c) issue pairwise DIDs under the hood while keeping the visible profile global.
   *Recommendation:* start with (c) plus an optional (a), and research (b).
8. **Trust signals and harms.** Showing "trust" invites reputation scores, exclusion, gatekeeping and social-credit dynamics. Decide what is ever displayed, who sees it, and whether it is computed at all. Prefer ZK threshold proofs over visible graphs. Consult the DTGWG Harms task force.
9. **Personhood.** Should Hylo ever issue personhood-grade VMCs (one per unique person)? Hylo can't guarantee uniqueness, because accounts are email-based. *Likely answer:* Hylo **consumes** personhood credentials, and only specific groups that do in-person verification issue them.

### Community and policy
10. **Who opts in, and the defaults.** Is this platform-wide, per group, or per user? *Recommendation:* per-group opt-in by stewards, with per-user wallet opt-in.
11. **Admission policy mapping.** Turning Hylo join barriers (questions, agreements, prerequisite groups, required roles, paywall) into machine-readable VTC policy. Which of OpenVTC's admission modes (open, invite, approval, member vetting, ZK hidden vetters) does Hylo expose?
12. **Revocation and due process.** Does a moderation action automatically revoke credentials? What appeal path exists? How do expiry and renewal work? Revocation is *public* in status lists, which is a privacy consideration.
13. **Portability promise.** What exactly can a group take when it leaves Hylo? Identity (a portable `did:webvh` or `did:webs`), its members' credentials, and its content? Write this down; it is the core value proposition.
14. **AI agents.** Should Hylo bots, integrations and AI assistants act under VDCs, with visible "acting on behalf of" provenance? This is a strong differentiator as agents enter communities.
15. **Voting.** Should personhood-gated, one-member-one-vote proposals and elections (`vtc/elections`, `voting/*`) be a product goal?

### Technical challenges
- **Spec churn.** The DTG credentials spec is a working draft (0.6), and Trust Tasks are mostly `draft` and frequently retired or superseded. Pin versions with `trust-tasks.lock`, isolate behind an adapter, and expect rework.
- **Language mismatch.** The reference implementations are Rust. A TypeScript SDK exists (types, a §7.2 consumer pipeline, proofs, TSP), but there is no TS VTC client, so the VTC would be a Rust service to operate.
- **Key management at scale.** Thousands of group DIDs, plus rotation, KMS, HSM/enclave options and audit. OpenVTC supports AWS/GCP/Azure/Vault/Nitro backends.
- **Inbound endpoints.** Hylo's VTA would need a DIDComm/TSP mediator or endpoint and service endpoints in its DID documents.
- **Revocation infrastructure.** Hosting and caching status lists, and the privacy of revocation.
- **ZK proofs.** The predicate credential system and the DTGWG ZKP spec are early. Threshold or anti-Sybil proofs across VRCs and personhood credentials are research-grade.
- **Legacy stack.** The backend runs knex 0.21, Bookshelf 1.2 and `oidc-provider` v7. Modern crypto libraries are fine, but plan for dependency friction.
- **Mobile.** Deep-linking to Keyring or other wallets from Expo, and possibly embedding a wallet. Avoid native-only work early (per Hylo's agent guidelines, this needs human-led mobile work).
- **UX for failure modes.** Distinguish "blocked by policy", "blocked by technology" and "couldn't check" (from #35) in every gating UI.

---

## 7. Proposed next steps (next 2–4 weeks)

1. **Decide** the posture (A+B with C-compatible design?) and name a pilot community.
2. **Spike** (1 engineer, about 2 weeks):
   - Node verification of a DTG VMC.
   - One Trust Task over HTTPS against a local `vtc-service`.
   - `did:webvh` publishing for one test group.
   - Resolve one `did:webs`.
   - Write findings into an ADR.
3. **Engage:**
   - Attend a DTGWG meeting and the HTX (UX) task force.
   - Ask OpenVTC about a TS/HTTP client for the VTC, `did:webs` support, and whether Hylo-style join barriers and responsibilities fit `vtc/*` tasks.
   - Ask the First Person Cooperative about VTC pilot onboarding and hosted VTA (fiduciary service provider) timelines.
4. **Design:** wallet-connect, badge issuance, and a "present credential to join" mock-up. Include translation strings for all locales when built.
5. **Write the portability promise** (Q13) and the trust-signals principles (Q8) *before* any trust-graph UI work.

---

## Appendix: Sources and coverage

**First Person Project White Paper v2.0** (Google Doc).
- Read: Executive Summary, Introduction, Parts 3–6 (ToIP, proof of personhood, DTG, VTI), Part 10, and the Conclusion.
- Not read in full: Parts 1–2 (background), Parts 7–9 (portable memory, fiduciary AI, the Linux Foundation and Greenbuild case studies), and the appendices.

**DTG Credentials spec** (https://trustoverip.github.io/dtgwg-cred-spec/). Only about the first 40% was read: through the VMC section plus the common fields. The VIC, VPC, VAC detail and the ZKP and conformance sections were not reviewed.

**Trust Tasks** (https://trusttasks.org/about, https://github.com/trustoverip/dtgwg-trust-tasks-tf). The repo was cloned. The spec inventory and `@openvtc/trust-tasks*` package metadata were reviewed, along with selected `vtc/*`, `auth/*` and `vetting/*` specs.

**OpenVTC** (https://openvtc.net/) and **VTI** (https://github.com/OpenVTC/verifiable-trust-infrastructure). The README and overview pages were reviewed.

**DTGWG discussion #35** (https://github.com/trustoverip/dtgwg-general/discussions/35). Read via summary.

**KERI.**
- https://keri.one/
- The KERI white paper v2.63 (https://github.com/SmithSamuelM/Papers/blob/master/whitepapers/KERI_WP_2.x.web.pdf): abstract, table of contents, §5 (trust spanning layer) and §9.5 (delegation and custodial key management).
- Ecosystem status (KERIA, Signify-TS, keripy, `did:webs`) comes from the WebOfTrust GitHub org (https://github.com/WebOfTrust) and the ToIP did:webs spec (https://trustoverip.github.io/kswg-did-method-webs-specification), as of early 2026. Verify the current state before relying on it.

**Hylo codebase.** The auth, identity, membership, roles, group relationships, moderation, tracks, API and schema code was mapped. File references are given inline above.
