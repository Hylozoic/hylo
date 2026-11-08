# P2P Hylo: Hosted and Peer-to-Peer Groups with One Identity

**Status:** Exploration draft, 2026-11-08.
**Companion to:** `docs/decentralized-trust-adoption-plan.md`.

**Positioning:**
- Hylo is an **alternative to OpenVTC** at the community layer. It stays **aligned on standards**: DIDs, DTG credentials, Trust Tasks.
- Hylo groups should therefore be VTC-compatible.
- Hylo should eventually be able to run as a **social layer on top of an OpenVTC community**.

---

## 1. Short answer: can one person be in both kinds of group with the same ID?

**Yes.** This works as long as the identity belongs to the *person* rather than to Hylo's database. Concretely:

1. **A user-controlled, rotatable root identifier.** For example a KERI AID (`did:webs` / `did:keri`) or a `did:webvh`. Hylo's numeric `users.id` becomes an internal alias for that identifier, not the identity itself.
2. **Device keys authorised by the root.** Each phone, laptop, browser or desktop app has its own key. Losing a device means revoking that one key, not changing your ID.
3. **Hosted groups authenticate the person by signature.** This uses a DID challenge-response (`auth/authenticate`), not a password. Hylo keeps running the group, but it knows the member by their DID.
4. **P2P groups know the member by the same DID.** The member appears in the group's signed membership log, and peers verify their signatures directly without asking Hylo.
5. **"Same ID" is a choice, not a requirement.** The DTG privacy model defaults to separate identifiers per context, to prevent cross-group tracking. So the UX should be **"join as…"**: use my public Hylo persona, or use a persona just for this group. Using the same persona everywhere is the user's call.

For people who don't want to manage keys, Hylo can hold the root *custodially*, as a delegator. They can later rotate control to their own devices **without changing their identifier**. KERI delegation and pre-rotation are designed for exactly this.

---

## 2. Identity layers (identical for hosted and P2P)

```
Root identity (person-controlled, durable, rotatable)
│   KERI AID (did:webs/did:keri)  or  did:webvh
│   key history + pre-rotation; optional custodial delegation by Hylo
│
├── Device keys  (phone secure enclave, desktop app, browser WebCrypto
│                 non-extractable key; passkey for recovery/unlock)
│                 authorised by the root; individually revocable
│
├── Personas     (public persona = today's Hylo profile; private personas
│                 per context), asserted with a Verifiable Persona Credential (VPC);
│                 each carries an r-card (JSContact profile)
│
└── Pairwise IDs (did:peer per relationship / per group, created automatically;
                  never correlated unless the user links a persona)
```

### Choosing the root identifier method (decision)

| | `did:webvh` | KERI (`did:webs` / `did:keri`) |
|---|---|---|
| OpenVTC / DTG alignment | **Native.** OpenVTC uses it. | Allowed in principle, since the DTG is method-agnostic. OpenVTC support needs confirming. |
| Works offline, peer-to-peer | Partly. The verifiable log can be passed peer-to-peer, but resolution normally goes over the web. | **Native.** Key event logs are transport-independent, and witnesses are optional. |
| Multi-sig and delegation (steward co-control, spaces delegated from their parent, custody migration) | Possible, but hand-built. | **Native.** |
| Libraries for web and mobile | Growing (Rust and TS). | keripy is stable. KERIA and Signify-TS are early (0.1.x as of early 2026). |

**This changes the earlier KERI conclusion.** For hosted-only Hylo, KERI was a "maybe, alongside". For P2P groups, KERI's transport independence is a real advantage.

*Suggested path:* support both methods in the verification layer. Prototype both in the P2P research phase (P0), then pick a default.

---

## 2b. Personas and profiles: unique relationships without re-entering profiles

In the DTG/VTC model, **each relationship with a community is cryptographically unique, but profile data is entered once and reused.** People never retype their profile per community.

Sources: the DTG credentials spec (`issuerScope`, VPC), the First Person Project white paper (persona management, r-cards), and the Trust Task families `persona/*` and `vtc/directory/*`.

### What is unique per community (the relationship)
- **An identifier just for that community.** It is a `pairwise` or `directed` DID, plus a private channel. The spec says a pairwise identifier "MUST NOT be used with more than one counterparty." OpenVTC: "each community can get a separate identity to prevent cross-community linking."
- **A membership credential pair.** The community issues a membership credential (VMC) to the member, and the member issues one back as consent.
- **Roles.** Authority and delegation credentials (VACs/VDCs) are issued per community.
- **Facts the community asserts about the member.** These are admin-sourced directory fields (`vtc/directory/card`) that the member can read but not change.
- **Why:** reusing one identifier everywhere would let communities collude to map a person's whole life. Separate identifiers make linking impossible unless the person chooses a shared persona.

### What is shared (the profile), held by the person's agent
1. **Attribute pool:** each fact (name, photo, bio, contact details, skills, location) is stored **once** (`persona/attribute/*`).
2. **Faces (profiles):** named compositions that **reference** pool facts rather than copying them (`persona/profile/*`). Changing a fact updates every face that uses it. Faces can be grouped into parts of life, such as Work, Home or Play (`persona/facet/*`, `persona/world/*`).
3. **Bindings:** the person chooses which face a given community sees (`persona/binding/set`). Wearing the same face in several communities is **intentional correlation**, asserted with a Verifiable Persona Credential (VPC).

### Supporting behaviour in the specs
- **Self-updating r-cards.** Recipients file each change as a new revision (`persona/contact/put`), so updates propagate and silent changes become visible.
- **Preview before disclosure.** Nothing is shared without a human-readable summary first (`persona/disclosure/preview` → `present`). The person also gets a history of what was shared with whom.
- **Correlation analysis.** The agent shows where the person's identities link, and warns when a link crosses parts of life they keep separate (`persona/correlation/analyze`).
- **Up-front directory disclosure.** A community publishes what its member directory reveals, and to whom, so applicants can read it before joining (`vtc/directory/disclosure`). The credentials spec also requires a VTC to publish whether member identifiers are disclosed beyond its VTA.
- **Context-local faces.** A face can be composed on the spot when a community asks for something specific (`persona/profile/compose`), and later promoted for reuse elsewhere.

### Implications for Hylo
- **Default experience unchanged.** Today's global Hylo profile becomes the person's **public face**, worn in every group unless they choose otherwise.
- **"Join as…" picker** when joining a group: my usual profile, a face just for this group, or a pseudonymous face.
- **Separate identifiers under the hood.** Hylo always mints a separate identifier per group. Groups can only link a person if the face they chose links them.
- **Per-group profile fields.** Stewards can define extra profile fields per group, and steward-written fields about members. Both map to `vtc/directory/fields` and `vtc/directory/card`.
- **No per-group profile copies.** Faces are views over one attribute pool. Making people maintain copies is the bad UX to avoid.
- **Hylo as the agent for people without one.** For hosted users without their own agent, Hylo holds the attribute pool and faces on their behalf, with export and migration to the person's own agent later.
- **Data-model sketch:**
  - `person_attributes` (the pool);
  - `person_faces` (references into the pool, plus face-local overrides);
  - `group_memberships.face_id` and `group_memberships.member_did` (pairwise or directed);
  - a disclosure log.

---

## 3. One dial: how much of a group Hylo runs

Every group, hosted or P2P, has two parts: a **membership authority** (who is in, who holds which role) and a **content set** (posts, chat, events). The group types differ only in who holds each part:

| Mode | Membership authority | Content lives | Hylo server's role |
|---|---|---|---|
| **1. Hosted** (today) | Hylo DB | Hylo DB (plaintext) | Everything |
| **2. Hosted + verifiable** | Hylo DB; credentials issued to members' wallets | Hylo DB | Everything, plus issuer |
| **3. Steward-controlled ("sovereign hosted")** | The group's own keys (steward M-of-N), or an OpenVTC VTC | Hylo, as a replica; content signed by authors | **A peer the group has granted rights to.** It provides web access, search, notifications and backup, and can be dismissed. |
| **4. P2P** | A signed membership/policy log maintained by stewards' agents (VTC-compatible) | Members' devices, plus optional relays | Optional **blind relay/backup**: stores ciphertext and cannot read it. Or nothing at all. |
| **5. Social layer over OpenVTC** | An external OpenVTC VTC | Hosted (mode 3) or P2P (mode 4) | As in mode 3 or 4 |

**The unifying idea: the Hylo server is just a member with delegated permissions.** A P2P group can *invite Hylo's agent* with a scoped Verifiable Delegation Credential: for example "may read content to provide search and email digests" or "may store ciphertext only". Revoking that credential fires Hylo. Moving a group between modes then means changing that grant, not migrating to a different product.

---

## 4. What a P2P group needs

1. **Membership and authority log.** A signed, replicated log of membership, role and policy events. It needs deterministic rules for concurrent conflicts (for example, two admins removing each other at the same moment).
   - *Recommendation:* model it as **DTG credentials** (membership credentials for members, authority credentials for roles), plus a VTC-style signed policy log with M-of-N admin approval. That makes **a P2P Hylo group *be* a VTC**, run by its stewards' agents, which is the alignment you want.
   - Alternatives worth a look: Keyhive (Ink & Switch, capability-based local-first access control, experimental) and p2panda's group and auth layer.
2. **Content replication.** Local-first data on each device: CRDT documents (Automerge, Yjs, Loro) or signed append-only operation logs (p2panda style). Sync runs over a peer-to-peer networking layer (Iroh, libp2p or WebRTC) with relays.
3. **End-to-end encryption.** MLS (RFC 9420) group keys, or Keyhive's BeeKEM. Keys rotate when a member is removed. **Removal cannot un-share** what a member already holds; it only cuts off future content.
4. **Availability.** Someone has to be online when a new member joins or a device returns. Options:
   - a desktop app left running,
   - a member's VTA,
   - a self-hosted relay,
   - a Hylo-hosted **blind relay/backup**, which is a plausible paid service.
5. **Mobile push.** APNs and FCM still require a server. The relay sends content-free "wake up" pushes, and the device decrypts locally.
6. **Invites and discovery.**
   - Invites are Verifiable Invitation Credentials, shared by QR code or link, carrying relay hints.
   - A group can optionally publish a public listing signed by its own DID (Murmurations, or a trust-network directory).
7. **Client architecture: reuse the UI.** Hylo's clients already talk GraphQL: `urql` on web and mobile (`packages/urql`), with graphcache on mobile. A custom urql exchange can **route each operation by group**, either to the hosted API or to a **local GraphQL executor** over the device's local-first store. The React and React Native UIs would mostly not need to know which kind of group they're showing.
   - **Hylo has done this before.** `Hylozoic/hylo-holo-dnas` (2019) implemented Hylo's `schema.graphql` on Holochain and redirected message-thread queries to it.
   - The Electron desktop app (`apps/desktop`) and the mobile app can be full peers.
   - Plain **web is the weak spot**: no background sync, and browsers can evict storage. It can act as a peer while the tab is open, or reach P2P groups through a relay or Hylo-as-member.
8. **Shared Rust core (an option).** OpenVTC (VTA, Trust Tasks), KERI (keriox), MLS (OpenMLS), Iroh and Automerge all have Rust cores. One Rust "Hylo peer" library could ship to desktop (via napi), mobile (an Expo module via uniffi) and web (WASM). That aligns naturally with OpenVTC and avoids writing the hard parts three times. The trade-off is a new language for the team.

---

## 5. Feature matrix: hosted vs P2P

| Feature | P2P feasibility | Notes |
|---|---|---|
| Posts, comments, reactions | ✅ | CRDT or op-log |
| Chat and DMs | ✅ | MLS |
| Events and RSVPs | ✅ | |
| Member directory, profiles | ✅ (within the group) | r-cards per persona |
| Roles and responsibilities | ✅ | Authority credentials in the policy log |
| Join questions, agreements, join requests | ✅ with a caveat | A steward, or a steward's delegated agent, must be online to admit people |
| Tracks | ✅ | Completion badges signed by stewards |
| "All my groups" home stream | ✅ | Merged on the client from hosted and local data |
| Proposals and voting | ⚠️ | Open tallies are easy. Secret ballots need cryptographic voting (Trust Tasks has `voting/*` drafts). |
| Maps and location | ⚠️ | Client-side only |
| Search | ⚠️ | Local per device, unless Hylo-as-member is granted read access |
| Email digests and notifications | ⚠️ | Need an agent with read rights. That is a trust trade-off the group decides. |
| Moderation and flagging | ⚠️ | Group-local. Content can be tombstoned and stop syncing, but cannot be deleted from devices that already have it. |
| Public groups, Explore, SEO | ❌ | Only via a published mirror (Hylo-as-member) |
| Paywalls, Stripe, funding rounds | ❌/⚠️ | Need a hosted component or VTA-based payments |
| Parent/child networks, group relationships | ⚠️ | Groups sign relationship credentials to each other. Hosted and P2P groups can be related across types. |
| AI features | ⚠️ | Local models, or agents acting under a Verifiable Delegation Credential |
| Analytics | ❌ | By design |
| Zapier and webhooks | ⚠️ | Through an agent run by a member |

---

## 6. Interactions across group types

- **One person, both types:** a single home screen and inbox covering both, with "join as…" persona selection on joining.
- **Group relationships across types:** a hosted network can include a P2P group, and the reverse. The relationship is a credential pair between the two group DIDs.
- **Hosted → P2P migration:**
  1. Stewards take the group's keys.
  2. Members receive membership credentials.
  3. Content is exported, signed by authors, into the local-first format.
  4. Hylo either downgrades to a blind relay or deletes its copy.
- **P2P → hosted (or adding web access):** the group grants Hylo's agent a read/serve delegation. Nothing else moves.
- **Over OpenVTC:** the group's membership authority is an OpenVTC VTC, and Hylo (hosted or P2P) supplies the content and coordination layer. Joining, vetting and role changes go through `vtc/*` Trust Tasks.

---

## 7. Hard problems

- **Key loss and recovery.** Options: social recovery, where trusted contacts in the trust graph act as guardians; KERI pre-rotation; a custodial fallback. This is the number-one adoption risk.
- **Safety, moderation and legal exposure.** Abuse in encrypted groups, Hylo's obligations when it relays ciphertext, and a policy for blind relays.
- **Authority conflicts.** Concurrent admin actions, network partitions, and stewards who go rogue (M-of-N helps).
- **Large groups.** Bootstrapping thousands of members, MLS commit traffic, and history size (snapshots).
- **Platform limits.** iOS background sync, and browser storage eviction.
- **Two backends.** Every feature needs a hosted path and a P2P path, or an explicit "not in P2P". Testing cost roughly doubles.
- **Spec churn.** DTG credentials (Working Draft 0.6) and the Trust Task drafts change often. Pin versions and keep them behind an adapter.
- **UX.** Explaining group types and personas without jargon. Nobody should ever see a DID.

---

## 8. Phasing and rough effort

These are very rough estimates, to be firmed up in P0.

| Phase | Scope | Rough size |
|---|---|---|
| **P0: Research spikes** | Prototype two desktop peers plus a relay. One group with posts, chat and a member removal. Compare `did:webvh` vs KERI, sync stacks, group-auth models (VTC log vs Keyhive vs p2panda) and MLS libraries. Write ADRs. | 6–8 weeks, 2 engineers |
| **P1: User-held identity on hosted Hylo** | Device keys, DID login, recovery, personas, custodial option. Overlaps adoption-plan Phase 1, and **benefits hosted users on its own**. | 2–3 months |
| **P2: Local-first client foundation** | Local store, per-group operation routing (urql exchange), offline cache for hosted groups. **Useful on its own:** offline use and speed. | 3–4 months |
| **P3: P2P group MVP** (desktop and mobile) | VTC-compatible membership log, invites, posts, comments, chat, events, members, roles, end-to-end encryption, relay sync. | 6–9 months, 3–4 engineers |
| **P4: Hylo server as peer** | Blind relay/backup service, opt-in Hylo-as-member (search, notifications, web access), migration in both directions | 3–4 months |
| **P5: OpenVTC interop** | Groups backed by an OpenVTC VTC; `vtc/*` Trust Tasks for joining and vetting | 2–3 months, depending on the specs |

**Total to a credible P2P MVP:** about 12–18 months with 3–5 engineers. P1 and P2 pay off for hosted Hylo even if P2P is paused.

---

## 9. Decisions to make

1. **Default root identifier:** `did:webvh` (best OpenVTC alignment), KERI (best for P2P, multi-sig and custody migration), or both.
2. **User-held keys for everyone, or opt-in?** For example custodial by default with "take your keys" later, versus keys required for P2P groups only.
3. **P2P launch scope:** which rows of §5 ship first.
4. **Web support for P2P groups:** a peer while the tab is open, relay-only, or none.
5. **Group authority model:** a VTC-compatible credential and policy log (recommended for alignment), or a capability system (Keyhive-style).
6. **Sync, networking and encryption stack**, and whether to adopt a **shared Rust core**.
7. **Hylo server roles and business model:** blind relay and backup, and Hylo-as-member services, as paid tiers.
8. **Relay policy:** moderation, legal and abuse handling for ciphertext Hylo stores.
9. **Persona defaults:** what "join as…" offers, and what is linked by default.
10. **Build on OpenVTC components or alongside them:** embed the VTA SDK and Trust Task runtimes, versus only speaking the protocols.
