# Jim Harshaw voice docs — integration plan

Source files:

- `docs/jim_harshaw_linkedin_voice_prompt.md` — **former wrestlers** niche
- `docs/jim_harshaw_linkedin_voice_prompt_athletes.md` — **former college athletes (all sports)** niche

Status: **implemented** (Phases 1–4 core). Re-seed + `db push` required after pull.

---

## 1. What the documents are

Both files are **operator playbooks for Claude-style reply drafting**: identity (Jim Harshaw Jr.), offer (Reveal Your Path), voice rules, a **7-stage conversation sequence** (0–7), adaptation tables, and hard “never do” rules.

They are **not** CSV/playbook JSON today — they are long-form markdown meant to be pasted wholesale into an LLM.

### Wrestlers vs athletes (key differences)

| Topic | Wrestlers doc | Athletes doc |
|--------|----------------|--------------|
| Audience | Former **wrestlers** | Former **college athletes** (any sport) |
| Bridge | Wrestling identity | College athletic identity |
| Stage 0 opener | "Fellow wrestler here" / wrestling intro | "Fellow college athlete here!" / ask what sport |
| Calendar | `jimharshawjr.net/wrestling-1706595139122` | `go.jimharshawjr.com/vsl` |
| Extra stage | — | **Stage 2C** — pain pushback ("I don't feel that way") |
| Sport talk | Deep wrestling insider (NCAAs, Big Ten, coaches) | Curious; **do not fake** sport expertise |

Everything else (tone, Reveal Your Path copy, follow-up cadence, no "my friend", no "did you find a time on my calendar") is largely shared.

---

## 2. How the app works today

```text
Agency base prompt (global, short)
        +
Playbook JSON per campaign (connect / intro / conversing / call_offered / call_booked)
        +
Prospect stage (Prisma enum) + last ~10 messages
        →
DeepSeek/OpenAI → JSON reply (messageText + nextStage)
        →
Guardrails (length, stop phrases, calendly rules, business hours)
```

### App prospect stages (technical)

`imported` → `profile_analyzed` → `connect_sent` → `connected` → `intro_sent` → `conversing` → `call_offered` → `call_booked`

### Jim doc stages (conversation)

| Jim | Meaning |
|-----|---------|
| 0 | Connection opener |
| 1 | They shared background → pain probe ("Do you ever feel that way?") |
| 2 | Pain confirmed → ask for call |
| 2B | "What is this exactly?" → Reveal Your Path explanation |
| 2C | Pain rejected → pivot (athletes only) |
| 3 | Yes → slots + calendar link |
| 4 | No reply 5–7d → follow-up 1, then 2 |
| 5 | Quiet after interest → re-offer calendar |
| 6 | Long-game re-engagement |
| 7 | No-show recovery |

**Gap:** The app does **not** model 2B, 2C, 4-first vs 4-second, 5, 6, 7 as separate stages. One `conversing` bucket drives most of the nuance via LLM — workable if the **system prompt** encodes Jim’s rules.

### Current defaults

- Seed template: generic `DEFAULT_WRESTLER_PLAYBOOK` (demo "College Wrestlers")
- Agency base prompt: one generic sentence
- Profile summarizer: wrestling-oriented hooks
- No loading of the two markdown files anywhere in code

---

## 3. Integration strategy (recommended)

**Principle:** Treat the markdown files as **source of truth**, compile them into structured config + prompt layers the existing agent already uses. Avoid pasting 300-line prompts on every token without structure.

### Layer A — Agency global (`AgencySettings.basePrompt`)

Compressed **Part 1–3 + Part 7** (who Jim is, offer, voice, never-dos, output rules):

- Sign as "Jim"
- Max 4–5 sentences unless Stage 2B-style explain
- No bullets in DM text
- Forbidden phrases list
- Calendar link placeholder `{{calendlyUrl}}`

### Layer B — Playbook template (per niche)

Two seeded templates:

1. `jim-wrestlers` → wrestlers markdown → `PlaybookConfig` + **sequence appendix** (Part 4–6 as `stages.*.instructions` or `playbook.sequenceGuide` field)
2. `jim-athletes` → athletes markdown → same shape, different openers, calendar URL, include Stage 2C rules in `conversing`

Map Jim stages → app stages (orchestrator + LLM):

| Jim situation | App `AgentStage` / playbook key | Notes |
|---------------|----------------------------------|-------|
| 0 connect note | `profile_analyzed` / `connect` | Use Jim Stage 0 templates |
| First DM after accept | `connected` / `intro` | Long opener or short follow-up |
| 1–2, 2B, 2C, 4, 5, 6, 7 | `conversing` | Prompt must say: detect substage from thread |
| 3 schedule | `call_offered` | Slots + `calendlyUrl` |
| Booked | `call_booked` | Thank-you template |

### Layer C — Conversation-aware reply (agent)

Before `generateReply`, optional **substage classifier** (same LLM, cheap JSON):

```json
{ "jimStage": "2B", "reason": "..." }
```

Inject into system prompt: `Current Jim stage: 2B — use Stage 2B rules from playbook.`

**Phase 1 shortcut:** Skip classifier; put full Part 4 summary in `conversing.instructions` and rely on message history (already last 10 messages).

### Layer D — Profile analysis

Extend `ProfileSummary` / summarizer prompt per niche:

- Wrestlers: school, conference, coaching connections, Pittsburgh/UVA commonalities
- Athletes: sport, school, level; **do not** invent wrestling details

### Layer E — Guardrails (code)

Add to `wordsToAvoid` / new checks:

- `synergy`, `leverage`, `value proposition`, `my friend`
- Block: "Were you able to find a time on my calendar?"
- Max **5 sentences** for DMs (sentence count guardrail)
- Sign-off must include `Jim` when outbound (optional)

Align delays with Jim: follow-up **5–7 days** → set `minDelayHours` ~120–168 for follow-up jobs (may need `followUpCount` on prospect).

### Layer F — Admin UX (client-safe)

**Do not** expose raw markdown to Jim’s client.

- Admin picks template: **Jim — Wrestlers** or **Jim — College Athletes**
- Form fields pre-filled from compiled playbook (business name, persona, stage instructions, calendar URL)
- "Advanced" collapsible: view-only excerpt of voice rules
- Publish flow unchanged

---

## 4. Implementation phases

### Phase 1 — Content in the app (MVP, ~1–2 sessions)

- [ ] Add `packages/agent/src/playbooks/jim-wrestlers.ts` and `jim-athletes.ts` (compiled from docs; human-reviewed)
- [ ] Seed `playbookTemplate` rows: `jim-wrestlers`, `jim-athletes`
- [ ] Set agency `basePrompt` from Part 1–3 (shared core)
- [ ] Default demo tenant campaign uses **jim-wrestlers** (or client tenant on create)
- [ ] `call_offered.calendlyUrl` = correct link per template
- [ ] Update `compile-prompt.ts` to include sequence guide + "identify Jim stage" instruction
- [ ] Expand `wordsToAvoid` in both playbooks
- [ ] Docs: which template to pick for which LinkedIn list

**Outcome:** New campaigns sound like Jim; no schema migration.

### Phase 2 — Smarter stage detection (~1 session)

- [ ] `jimConversationStage` in LLM output OR pre-call classifier
- [ ] Prospect fields: `lastJimStage`, `followUpCount`, `lastOutboundAt`
- [ ] Orchestrator: Stage 4 second follow-up only when `followUpCount >= 1` and no inbound
- [ ] Detect 2B ("what is this") and 2C ("don't feel that way") from inbound keywords

**Outcome:** Follow-ups and explain-the-offer messages match doc timing and branch.

### Phase 3 — Profile + commonalities (~1 session)

- [ ] Richer LinkedIn scrape (Education, Experience) if not already
- [ ] Summarizer uses Jim Part 5/6 tables
- [ ] `suggestedOpener` follows Stage 0 rules (profile-driven)

**Outcome:** Connect/intro messages reference school/sport specifically.

### Phase 4 — Optional "learn from past conversations" (later)

Not in Jim docs but aligns with client goals:

- [ ] Export threads where `call_booked` or positive replies
- [ ] Offline job: suggest playbook tweaks (admin approves)
- [ ] Does **not** auto-change production playbook without publish

---

## 5. Decisions needed from Jim / client

1. **Default niche for first client tenant:** wrestlers only, athletes only, or two campaigns?
2. **Calendar URL per campaign:** confirm wrestlers vs athletes links above.
3. **Connection request note:** always short ("Fellow wrestler here") vs longer intro — affects `connect` template only.
4. **Automation level:** full auto send vs draft-for-review (`shouldEscalateToHuman` on low confidence)?
5. **EST time slots in Stage 3:** auto-generate slots in prompt or Jim handles manually after AI suggests "offer calendar"?

---

## 6. Files likely touched (when implementing)

| Area | Files |
|------|--------|
| Playbooks | `packages/agent/src/playbooks/*.ts`, `default-playbook.ts` |
| Prompt compile | `packages/agent/src/compile-prompt.ts`, `llm.ts` |
| Guardrails | `packages/agent/src/guardrails.ts` |
| Seed/templates | `packages/db/prisma/seed.ts` |
| Shared schema | `packages/shared/src/playbook.ts` (optional `sequenceGuide`, `niche`) |
| Orchestrator | `apps/worker/src/orchestrator.ts` |
| Admin UI | `apps/web/.../playbook`, `admin/templates` |
| Docs | Keep `jim_harshaw_*.md` as source; this plan as roadmap |

---

## 7. Risks

- **Prompt size:** Full markdown in every call is expensive; use compiled summaries in Phase 1.
- **Stage mismatch:** Wrong branch (e.g. calendar too early) — mitigate with classifier in Phase 2.
- **Two calendars:** Wrong template on wrong list → wrong booking link; tie template to campaign niche in UI.
- **LinkedIn ToS / volume:** Jim’s follow-up persistence is in voice doc; guardrails must cap outbound (already exist).

---

## 8. Suggested order of work

1. Client confirms wrestlers vs athletes (or both).
2. Implement **Phase 1** playbooks + seed + calendar URLs.
3. Test one fake prospect thread through stages 0 → 2 → 3 on local + Jim review messages.
4. Phase 2 follow-up timing + 2B/2C detection.
5. Phase 3 profile depth.

No code changes until you approve this plan or adjust phases.
