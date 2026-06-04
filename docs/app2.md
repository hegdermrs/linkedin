# LinkedIn Outreach Assistant — Plain-Language Overview

**Audience:** Busy business owners (no tech or AI background)  
**Use:** Source material for presentation slides  
**Example client built into the product:** Jim Harshaw Jr. — executive coach reaching former college wrestlers and athletes on LinkedIn

---

## Slide 1 — One sentence

**We built a system that helps a coach start real conversations on LinkedIn at scale — in their own voice — until someone books a call.**

---

## Slide 2 — The problem (why this exists)

Most owners already know LinkedIn works for finding clients. The hard part is not *finding* people — it is *doing the follow-up*:

- Hundreds of prospects in a list (for example, from Sales Navigator)
- Each person needs a personal touch, not a copy-paste blast
- Messages must sound like **you**, not a robot or a salesperson
- Replies come at random times; you cannot sit on LinkedIn all day
- You still need a clear path: connect → chat → offer a call → book on the calendar

Hiring more people is expensive. Ignoring the list wastes opportunity. This app sits in the middle: **it does the repetitive outreach work using rules you approve, and you stay in control.**

---

## Slide 3 — What we built (in everyday terms)

Think of it as **three parts working together:**

| Part | What it is (simple) | What it does for the business |
|------|---------------------|-------------------------------|
| **Your dashboard** | A private website you log into | Upload prospects, see pipeline, pause or resume outreach, set your booking link |
| **The worker** | A background helper that uses a real browser | Logs into LinkedIn as you (with your permission), sends requests and messages, checks for replies |
| **The writing brain** | Software that drafts each message | Reads the prospect’s profile and full conversation, then writes the next message using **your playbook** (tone, words to use, words to avoid, stage-by-stage goals) |

There is also an **agency view** for teams that run outreach for more than one client: separate accounts, separate playbooks, audit history.

---

## Slide 4 — The journey of one prospect (story format)

Imagine **Alex**, a former wrestler on your target list.

1. **Imported** — Alex’s name and LinkedIn link come from a spreadsheet you upload (typical export from Sales Navigator).
2. **Profile reviewed** — The system reads Alex’s public profile and notes useful details (school, sport, headline) so the first message can feel personal.
3. **Connection request sent** — A short note goes out (for example, “Fellow wrestler here…” — wording comes from your playbook).
4. **Waiting / connected** — If Alex accepts, the system moves forward. If not, Alex is marked as no response and the system stops chasing.
5. **First message after connect** — A warm opener, still in your voice, often asking about their athletic background.
6. **Conversation** — Back-and-forth is handled like a trained assistant following your sales script: build rapport, explore a pain point you care about, offer a free coaching call when the timing is right — not on message one.
7. **Call offered** — When Alex is ready, your calendar link (Calendly) is shared in a natural way.
8. **Call booked** — When Alex books, the system sends a short thank-you and stops selling.

If Alex says “stop” or “not interested,” the system **stops immediately** and marks them as opted out.

**Business takeaway:** Every person is on a visible track. You are not guessing who was contacted or what was said.

---

## Slide 5 — “AI” explained without jargon

In this app, “AI” means **a smart text assistant** — similar to asking a careful employee to draft an email, except:

- It always reads **your written playbook** first (who you are, how you talk, what each stage should accomplish)
- It sees **the actual thread** with that person, not just their name
- It must answer in a **fixed format** (message + what stage we’re in + short reasoning for records)
- **Safety checks run after every draft** — too long, wrong tone, banned phrases, calendar link at the wrong time → message is blocked or rewritten

It is **not** “the AI decides your strategy.” Strategy is in the playbook you publish. The assistant executes and personalizes.

**Analogy for slides:**  
*Playbook = how you train a new team member. AI = that team member writing the next line, while a manager (guardrails) reviews it before Send.*

---

## Slide 6 — The playbook (your business IP in software)

A **playbook** is the heart of the product. For Jim Harshaw, it includes:

- **Brand voice** — Casual, fellow-athlete tone; words to use (“on the mat,” “another gear”); words to avoid (“synergy,” “my friend,” pushy calendar lines)
- **Stage instructions** — What to say when connecting, when introducing yourself, during back-and-forth, when offering a call, after someone books
- **Example templates** — Starting points the assistant adapts (uses their school, sport, etc.)
- **Guardrails** — Daily caps (connections, messages, profile views), business hours only, max messages without a reply, automatic stop on “unsubscribe” language

Two niches are built in: **former wrestlers** and **former college athletes** (slightly different openers and calendar links).

**Takeaway:** The better your playbook, the more the system sounds like you. Technology does not replace a clear offer and conversation design — it **enforces** it.

---

## Slide 7 — What the business owner actually does

| You do | The system does |
|--------|-----------------|
| Connect LinkedIn once (secure session) | Sends requests and messages within daily limits |
| Upload or paste prospect list | Tracks every person and stage |
| Set timezone and Calendly link | Waits for replies and continues threads |
| Pause campaign when traveling or busy | Respects business hours and delays between messages |
| Review dashboard and prospect list | Logs what was sent and why (audit trail for agency) |
| Step in when LinkedIn asks for login again (“needs human”) | Stops on opt-out phrases |

**Minimum weekly attention:** Glance at metrics, fix LinkedIn login if flagged, adjust playbook when offer or messaging evolves.

---

## Slide 8 — What you see on the dashboard (proof, not promises)

Numbers owners care about, updated as outreach runs:

- Total prospects in the campaign
- Connection requests sent and **acceptance rate**
- Conversations started
- Calls offered and **calls booked**
- Pause / resume button — one click to stop all automated activity

**Prospects page:** Each person’s stage (imported → connected → conversing → call booked, etc.) and recent messages.

**Takeaway:** This is operations software, not a black box. You can audit performance like any other sales channel.

---

## Slide 9 — How we built it (high level, no acronyms)

For slides, you can describe the build in **four layers**:

1. **Website (dashboard)** — Where clients and agency staff log in, edit playbooks, import CSVs, view results.
2. **API (brain of the office)** — Stores clients, campaigns, prospects, messages, and settings in a secure database.
3. **Worker (hands on keyboard)** — A separate process that picks up tasks from a queue: “analyze this profile,” “send this connection,” “check inbox,” “send this reply.” It drives LinkedIn through browser automation (same idea as a person using Chrome, but automated).
4. **Agent package (voice + rules)** — Combines global agency instructions + client playbook + conversation history → draft message → guardrails → send or hold.

**Hosting:** Can run on a cloud platform (e.g. Railway) or a single server with Docker — database, queue, API, worker, and website together.

**Built as a monorepo** — one codebase with shared rules so wrestler vs athlete playbooks stay consistent and updates ship once.

---

## Slide 10 — Safety, limits, and honesty

**Built-in safety**

- Daily limits on connections, messages, and profile views (tunable per playbook)
- Only sends during configured business hours
- Stops if prospect uses stop / not interested language
- Blocks sloppy or off-brand drafts (length, banned words, wrong calendar phrasing)
- Campaign pause stops new work immediately

**Risks to disclose on a slide (credibility)**

- LinkedIn’s own rules may restrict automation; accounts can be limited if activity looks unnatural — hence conservative limits and monitoring
- Sometimes LinkedIn requires a **human login** again; the dashboard warns you
- The system is best for **structured outbound** with a clear call offer — not for replacing high-stakes judgment on every edge case

**Takeaway:** Responsible scale means **rules + limits + visibility**, not “send unlimited spam.”

---

## Slide 11 — Who this is for

**Strong fit**

- Coaches, consultants, or B2B sellers with a **repeatable conversation path** and a calendar booking step
- Owners who already have (or can build) a prospect list export
- Teams that want **one voice, many prospects**, with an agency managing playbooks

**Weaker fit**

- Brand-new businesses with no clear offer or script yet
- Channels where personal video or phone is the only acceptable first touch
- Anyone unwilling to monitor LinkedIn account health

---

## Slide 12 — Key takeaways (closing slides)

1. **Problem:** LinkedIn outreach does not fail because of leads — it fails because consistent, on-brand follow-up does not scale with one person’s calendar.

2. **Solution:** A playbook-driven assistant that automates the *mechanical* steps while keeping *your* voice and *your* stages.

3. **AI’s role here:** Draft and personalize within strict rules — not invent your business strategy.

4. **Control:** Pause button, daily caps, business hours, opt-out detection, full message history.

5. **Outcome metric:** Conversations that end in **booked calls** (Calendly integration), not vanity metrics alone.

6. **Strategic lesson for owners:** Document how you sell (playbook) once; technology can run it many times. The investment is in **clarity of message and sequence**, not in learning to code.

7. **For Jim Harshaw specifically:** Former athletes and wrestlers get messaging that respects insider language and a 7-step-style conversation path — compressed into software the agency can tune without rewriting code.

---

## Optional appendix — Slide titles only (copy-paste list)

1. The bottleneck: follow-up, not leads  
2. What we built in one sentence  
3. Three parts: dashboard, worker, writing brain  
4. Alex’s journey: from list to booked call  
5. AI = trained drafter + manager review  
6. Your playbook is the product  
7. What you do vs what runs automatically  
8. Dashboard: metrics that matter  
9. How we built it (four layers)  
10. Safety, limits, and honest risks  
11. Is this for you?  
12. Seven takeaways for busy owners  

---

## Glossary (hide or use on one “terms” slide)

| Term | Say this instead |
|------|------------------|
| LLM | Smart writing assistant |
| Playbook | Your approved sales script and voice rules |
| Playwright / browser automation | Software that uses LinkedIn like a person in a browser |
| Tenant | One client account in a multi-client setup |
| Orchestrator | Scheduler that decides “who needs the next action now” |
| Guardrails | Automatic quality and safety checks before send |
| Calendly webhook | When someone books, the system can mark them “call booked” automatically |

---

*Document generated from the LinkedIn Outreach Agent codebase (README, HANDOFF, schema, orchestrator, Jim Harshaw playbooks). Last aligned to product behavior as of project handoff notes.*
