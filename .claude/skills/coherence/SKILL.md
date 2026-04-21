---
name: Coherence
description: Maintain a living, self-updating understanding of a repo through a decomposable document surface. Use when you want project coherence that accrues over time via one-question-at-a-time investigation rather than one-shot snapshots. Complements bootstrap-project (which produces a snapshot) by providing ongoing continuity.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
---

# Coherence Skill

## Purpose

Maintain a living, continuously-updating understanding of any repo or project through a persistent documentation surface that decomposes infinitely.

Unlike `bootstrap-project` (which produces a one-shot snapshot of a codebase), the coherence skill accrues understanding over repeated invocations. Each invocation investigates **one** question, writes **one** finding, and generates new sub-questions for future invocations to pick up. Over time, the `.claude/coherence/` directory becomes a living graph of what is known about the project.

**Architectural claim**: documentation is the only substrate where the complexity wall can be split infinitely. One file per decision, one file per commitment, one file per question. Repeated skill invocations communicate exclusively through the doc tree — no shared state, no coordination protocols, no central orchestration. Sub-agents "spawn" by writing a new question file; the next invocation that picks it up is effectively a child. The substrate flattens the wall because the substrate is itself naturally decomposable.

## Auto-Activation Triggers

This skill activates when:
- User invokes the `/coherence` slash command
- User says "update coherence", "refresh understanding", or "run a coherence cycle"
- A scheduled task fires (via the `schedule` skill)
- A hook detects new source material in `.claude/coherence/sources/`

## CRITICAL: Substrate Rules

The entire architecture rests on these rules. Violate any of them and the complexity wall re-forms inside the skill itself.

1. **One atomic unit per file.** Never `decisions.md` containing 50 decisions. Always `decisions/2026-04-07-postgres-choice.md` containing one decision. Same for commitments, blockers, questions. This is the "infinitely splittable" property in mechanical form.
2. **Cite sources always.** Every assertion in a derived doc must reference the source file (and line, where applicable) that grounds it. Uncited claims are not allowed. Hallucination is fatal for a coherence system.
3. **Sub-agents spawn through documents, not function calls.** If a question is too big to answer in one pass, do not attempt it — write sub-questions into `questions/` and let the next invocation pick them up. The spawning *is* the file write.
4. **Write only inside `.claude/coherence/`.** The skill reads the whole target repo but writes exclusively to the `.claude/coherence/` directory by default. To grant broader write access (file issues, rewrite docs, commit to git), extend `allowed-tools` in a per-project override — never loosen the default.
5. **Idempotent.** Running the skill twice in a row must not duplicate work. Before writing a new decision file, check whether an equivalent one exists and update it instead. The bookkeeping file `.coherence-state.json` tracks prior work to support this.

## Core Workflow (v0 — one cycle per invocation)

### Step 1: Locate or initialize the coherence surface

```bash
TARGET="${ARGUMENTS:-.}"
COHERENCE="$TARGET/.claude/coherence"
```

If `$COHERENCE` does not exist, scaffold it:

```
.claude/coherence/
  understanding.md           # TL;DR of current knowledge (appended to each cycle)
  surface-map.md             # What surfaces this skill has scanned
  questions/                 # one file per open question
    answered/                # questions that have been resolved
  decisions/                 # one file per decision, dated
  commitments/               # one file per commitment (to users, to self)
  blockers/                  # one file per open blocker
  customers/                 # (optional) per-customer state
  sources/                   # append-only raw material (meeting notes, transcripts, screenshots)
  .coherence-state.json      # skill bookkeeping (invocation count, last run, attempt history)
```

Create every directory even if empty. Write a header stub to `understanding.md` and `surface-map.md`. Write initial `.coherence-state.json` with `invocation_count: 0`.

### Step 2: Scan the target surface

Walk the target repo excluding: `.git`, `node_modules`, `artifacts`, `coherence`, `.venv`, `__pycache__`, `dist`, `build`.

Classify what's present:
- Source code files (by language)
- Config files (package.json, requirements.txt, pyproject.toml, Dockerfile, etc.)
- Markdown docs
- `.claude/` directory if present (from `bootstrap-project`) — including any sub-directories like `agents/`, `audits/`, `investigations/`, `metrics/`, `hooks/`, `guidance-team/` that may exist in richer setups
- Test directories
- `.claude/coherence/sources/` contents if user has dropped manual material there

Update `surface-map.md` with the current inventory. Include `last_scanned` timestamp. Diff against the previous scan if one exists — note what's new, what's gone.

#### Drift check against bootstrap baseline (if applicable)

If `.claude/BOOTSTRAP_REPORT.md` exists, compare current source file line counts against what the report describes (e.g., bootstrap may say `colony.py ~253 LOC`; check `wc -l colony.py`). Note any significant drift (≥10% change in LOC or files added/removed) in `surface-map.md` under a `## Drift since bootstrap` heading. **This is the cheapest way to detect that a project has been actively edited since bootstrap and the architecture spec may need re-verification.** Drift findings worth investigating become candidate sub-questions in Step 4.

### Step 3: Read current state

Read in this order (fail gracefully if any are missing):

1. `understanding.md` — prior synthesized knowledge
2. `.coherence-state.json` — bookkeeping, attempt history
3. Up to 5 most recent files in `decisions/` — recent activity
4. All files in `questions/` — open questions from prior cycles
5. Target repo's `.claude/specs/architecture.md` if present — bootstrap output
6. Target repo's `.claude/BOOTSTRAP_REPORT.md` if present
7. Target repo's `CLAUDE.md` if present
8. Anything new in `.claude/coherence/sources/` since `last_run`

**Do not duplicate bootstrap-project content** in `understanding.md`. Link to it and add novel observations only.

### Step 4: Generate new questions

**Idempotency precondition**: before generating, you must have read `.coherence-state.json` (Step 3 already did this). The state file's `recent_attempts` array tells you which question slugs have already been attempted in prior cycles. Treat any slug that appears in `recent_attempts` with `status: complete` as **already done** — never regenerate a semantically-equivalent question for it. Slugs with `status: partial` or `status: needs-more-investigation` are eligible for re-attempt only if you have new information that wasn't available last time.

Compare the current surface map against the current understanding. What is not yet known? Good questions are:
- **Specific**: "What changed in colony.py between commits abc123 and def456?" not "how does colony work?"
- **Answerable with available tools**: Read, Grep, Bash (read-only)
- **Non-duplicative**: check existing `questions/` (open AND `answered/`), `decisions/`, AND `.coherence-state.json:recent_attempts` first
- **Actionable**: has a clear investigation approach

Examples of good questions for a code repo:
- "Which files have been modified in the last 7 days and why?"
- "Are there TODO/FIXME comments that reference other files — what's the implied dependency graph?"
- "What is the current test coverage status — any tests failing or skipped?"
- "What external dependencies are declared and when were they last updated?"
- "What environment variables does this project read and are they all documented?"

Write 3-5 genuinely new questions. For each, create `questions/YYYY-MM-DD-HHMM-slug.md` containing:

```markdown
# Question: [one-sentence question]

**Created**: 2026-04-07 12:34
**Priority**: high | medium | low
**Why it matters**: [one sentence]
**Investigation approach**: [concrete steps — what files to read, what commands to run]
**Status**: open
```

Skip any question that duplicates an existing open or answered question (by semantic match, not exact string).

### Step 5: Pick the most important unanswered question

From `questions/` (not `questions/answered/`), pick one using this ordering:

1. Highest `Priority: high` whose slug is **not** in `.coherence-state.json:recent_attempts` with `status: complete`
2. If all high-priority are complete: highest `Priority: medium` not complete
3. If all of those are complete: highest `Priority: low` not complete
4. Within a priority tier, prefer questions with the fewest prior attempts (use `recent_attempts` to count)
5. Break ties by recency (most recently created first — probably most relevant to current work)

**Critical idempotency rule**: if every open question has `status: complete` in `recent_attempts`, the cycle is in a steady state. Do NOT re-attempt a complete question just to fill a cycle. Instead:
- Run the staleness check from the "no new questions" edge case
- OR file a meta-question about whether there is anything new to investigate
- OR exit cleanly with a "nothing new to do" report

Record the attempt in `.coherence-state.json` BEFORE starting investigation (so a crashed cycle doesn't appear "untouched"):
```json
"recent_attempts": [{"question_slug": "...", "status": "in_progress", "ts": "..."}]
```
Update `status` to `complete` / `partial` / `needs-more-investigation` after Step 7.

### Step 6: Investigate

Use Read, Grep, Glob, and **read-only** Bash commands (`git log`, `git diff`, `ls`, `cat` via Read, tests with `--dry-run` flags). Do NOT run anything that modifies state: no test runs that write files, no git commits, no package installs, no network calls (unless explicitly allowed via tool grants).

Keep the investigation bounded to ~10 tool calls. If the question turns out to be too big:
- Write partial findings
- File 2-3 sub-questions narrowing the problem
- Mark status as `needs-more-investigation`

### Step 7: Write findings

Create `decisions/YYYY-MM-DD-HHMMSS-slug.md`:

```markdown
# Finding: [one-sentence summary]

**Answers**: questions/YYYY-MM-DD-HHMM-original-slug.md
**Investigated**: 2026-04-07 12:45
**Status**: complete | partial | needs-more-investigation

## Question
[full original question text]

## Findings
[concrete statements, each with inline citation]
- [claim] (source: `colony.py:181`)
- [claim] (source: `.claude/specs/architecture.md:117`)
- [claim] (source: `git log abc123`)

## Sources consulted
- [file:line or command]
- [file:line or command]

## Sub-questions discovered
- [new question that emerged — also written to questions/]
```

Move the original question file to `questions/answered/` (do not delete — history matters for idempotency checks).

### Step 8: Update understanding.md (with active size check)

Append a **brief** synthesis to `understanding.md`:

```markdown
## 2026-04-07 — [one-sentence what was learned]
[2-4 sentences summarizing the finding]
→ Full: [decisions/YYYY-MM-DD-HHMMSS-slug.md]
```

Then **measure** the file with `wc -l understanding.md` and act based on size:

| Lines | Action |
|---|---|
| < 200 | Healthy. No action. |
| 200-399 | Approaching consolidation threshold. File a `medium` priority sub-question: "Consolidate `understanding.md` — currently N lines, retiring entries older than X" |
| 400+ | **Active consolidation required.** File a `high` priority sub-question to consolidate. Do NOT generate any other new questions this cycle — the next cycle should consolidate before doing more investigation. |

`understanding.md` is the TL;DR index, not the archive. Detailed findings live in `decisions/` and stay there forever; `understanding.md` summarizes only what's currently relevant. Consolidation moves stale entries to `understanding-archive-YYYY-MM.md` and keeps the live file focused.

### Step 9: Update `.coherence-state.json`

Schema (every field is required unless marked optional):

```json
{
  "version": "0.2.0",
  "skill_version": "0.2.0",
  "target": "/absolute/path/to/target/repo",
  "last_run": "2026-04-07T12:45:00Z",
  "invocation_count": 42,
  "total_questions_generated": 28,
  "total_decisions_written": 19,
  "total_questions_answered": 19,
  "open_question_count": 9,
  "understanding_md_lines": 87,
  "recent_attempts": [
    {
      "question_slug": "2026-04-07-1245-some-slug",
      "status": "complete",
      "ts": "2026-04-07T12:45:00Z",
      "decision_file": "decisions/2026-04-07-1245-some-slug.md",
      "attempt_number": 1
    },
    {
      "question_slug": "2026-04-06-0900-other-slug",
      "status": "partial",
      "ts": "2026-04-06T09:00:00Z",
      "decision_file": "decisions/2026-04-06-0900-other-slug.md",
      "attempt_number": 2
    }
  ],
  "notes": "(optional) human-readable notes about anything unusual this cycle"
}
```

**Field contracts:**

- `version` / `skill_version`: track schema and skill version separately so future migrations can be safe
- `target`: absolute path; lets a state file be moved without losing context
- `recent_attempts`: keep last 50 entries; older ones drop off (use FIFO eviction)
- `attempt_number`: 1 for first attempt, increments if the same question is re-attempted
- `understanding_md_lines`: enables the size check in Step 8 to be cheap (read from state, verify with `wc -l` only when needed)
- `open_question_count`: count of files in `questions/` (excluding `answered/`), used by reporting

If the state file is corrupt, follow the error-handling rule: back it up and regenerate from the directory contents (count files, walk decisions, etc.). The directory is the source of truth; the state file is a cache.

### Step 10: Report to the user

Return a brief, structured report:

```markdown
## Coherence Cycle Complete

**Target**: /path/to/repo
**Invocation**: #42
**Surface changes since last scan**: [3 new files, 1 deleted]

**New questions generated**: 4
- [list with slugs]

**Question investigated**: [slug] — [status: complete | partial]
**Finding**: [decisions/<file>.md] — [one-line summary]

**Open questions remaining**: 12
**Suggested next cycle**: [slug of the next most important question]
```

## Edge Cases

### Target repo has no `.claude/coherence/` directory yet
**Handling**: Create it in Step 1. This is a "bootstrap run" — no prior state. First investigation should be the most fundamental question: "What is this project and what are its entry points?" — unless `.claude/BOOTSTRAP_REPORT.md` already answers it, in which case pick a more specific first question.

### Target has existing `.claude/` from bootstrap-project
**Handling**: Read the bootstrap output as high-authority prior knowledge. Write it into `understanding.md` as a citation (not a duplication). Focus coherence cycles on what bootstrap did NOT capture: recent changes, ongoing decisions, open questions, customer/commitment tracking.

### A question has been attempted 3+ times with only partial findings
**Handling**: The question is too big or poorly scoped. Move it to `questions/hard/` and flag it for human attention in the cycle report. Do not keep attempting it automatically.

### `.claude/coherence/sources/` contains manual material the user dropped in
**Handling**: Treat with high priority. These represent explicit user intent about what to ingest. In Step 4, prioritize generating questions targeted at understanding them. In Step 6, cite them explicitly. Move processed sources to `.claude/coherence/sources/ingested/` (append-only — never delete).

### Very large repo (>1000 source files)
**Handling**: v0 is single-threaded. Don't scan the whole repo every cycle — use `git log --since="1 day ago"` to focus on recent activity. Document the scoped scan in `surface-map.md`. Full scans happen only on first run or when explicitly requested.

### Bootstrap output conflicts with current reality
**Handling**: This is a coherence-detection success case. File a high-priority question: "Bootstrap says X at [source:line] but current file shows Y at [source:line] — which is correct?" Investigate in a subsequent cycle. Never silently overwrite bootstrap output.

## Error Handling

### If a tool call fails during investigation
1. Log the failure inline in the decision file: `**Investigation blocked**: [reason]`
2. Mark question status as `needs-more-investigation`
3. Continue to Step 8 — do not crash the cycle

### If `.coherence-state.json` is corrupt
1. Back it up to `.coherence-state.json.bak-YYYYMMDD-HHMMSS`
2. Regenerate minimal state: `{"version": "0.2.0", "skill_version": "0.2.0", "invocation_count": 0, "last_run": null, "recent_attempts": [], "open_question_count": 0, "understanding_md_lines": 0}`
3. Note the recovery in the next cycle report

### If no new questions can be generated (coherence is "complete")
1. This should be rare, but possible for small stable repos
2. Run a staleness check: are any decisions older than 30 days that should be re-verified?
3. File a question about the oldest unverified decision
4. If everything is verified and stable, report that and exit cleanly

### If the skill is invoked with no target directory
1. Default to current working directory
2. Proceed normally

## Integration Points

### With bootstrap-project
- Reads `BOOTSTRAP_REPORT.md` and `specs/architecture.md` as prior knowledge
- Does not re-run bootstrap — assumes it has already been done (or the project is new enough not to need it)
- Coherence is the *continuation* of bootstrap, not a replacement

### With the schedule skill
- A single coherence invocation is bounded in scope (one question per cycle)
- `schedule` can run `/coherence` hourly, daily, or weekly for continuous updates
- Example: `schedule create --cron "0 9 * * *" --command "/coherence /path/to/repo"`

### With hooks
- PostToolUse hook on Write tool → notices new files in `.claude/coherence/sources/` and triggers next cycle
- Stop hook → runs a quick coherence cycle at the end of each Claude session

### With memory-consolidation
- Findings in `decisions/` that represent reusable patterns can be promoted into `.claude/memory/active/procedural-memory.md` (separate skill, manual trigger)

### With pain-point-manager
- Findings that describe friction or blockers can be escalated to `.claude/pain-points/active-pain-points.md`

## Extensibility (beyond v0)

v0 is deliberately minimal: one skill, one cycle, one question. Future versions can add:

- **v0.2**: Conflict detector as a separate agent role (reads recent decisions, flags contradictions)
- **v0.3**: Parallel investigation (use `Task` tool to spawn multiple investigators per cycle)
- **v0.4**: Tool grants per target repo (allow the skill to file issues, run tests, commit to git)
- **v0.5**: Cross-repo coherence (link findings across multiple related repos)
- **v1.0**: Self-directed scheduling (the skill decides when to run itself based on activity)

Each of these is additive. v0 must work correctly before any of them are built.

## Skill Metadata

**Version**: 0.2.0
**Created**: 2026-04-07
**Category**: Context Maintenance / Coherence
**Origin**: Design-driven (colony_mvp design conversation, 2026-04-07)
**Dependencies**: None (uses only built-in Claude Code tools)
**Maintenance**: Manual invocation initially; scheduling once v0 is validated on a real repo

## Changelog

### v0.2.0 — 2026-04-07
Improvements based on cycle #1 self-evaluation against colony_mvp:
- **Idempotency**: Step 4 + Step 5 now explicitly read `.coherence-state.json:recent_attempts` and refuse to re-attempt complete questions. Steady-state detection added (cycle exits cleanly when nothing new to do).
- **Drift detection**: Step 2 now compares current source LOC against `BOOTSTRAP_REPORT.md` baseline and notes drift in `surface-map.md`.
- **Active consolidation**: Step 8 now measures `understanding.md` line count after each append and escalates with priority-tiered sub-questions when it exceeds 200/400 lines.
- **State schema**: Step 9 schema is now self-documenting with field contracts, FIFO eviction rule for `recent_attempts`, and explicit recovery semantics ("directory is source of truth, state file is cache").
- **Rich `.claude/` handling**: Step 2 explicitly mentions `agents/`, `audits/`, `investigations/`, `metrics/`, etc. as scannable subdirs (relevant for projects like `playmakers-data`).

### v0.1.0 — 2026-04-07
Initial design-driven implementation. One investigation per cycle. Substrate rules, 10-step workflow, 5 edge cases, 4 error handlers.
