---
description: Run one cycle of the coherence skill — maintain a living understanding of a repo through the document surface
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Task
tags: [coherence, documentation, continuous-understanding, context]
---

# /coherence

**Usage**: `/coherence [target_directory]`

Invoke the `Coherence` skill to run one cycle of self-directed investigation on a target repo. Each invocation makes incremental progress by asking one question, investigating it, and writing findings to the `.claude/coherence/` document surface.

Default target is the current working directory.

---

## What it does (one cycle)

1. Scans the target repo and updates `.claude/coherence/surface-map.md`
2. Reads prior state from `.claude/coherence/understanding.md`, `questions/`, and `decisions/`
3. Generates 3-5 new questions about what is not yet understood
4. Picks the single most important unanswered question
5. Investigates it using read-only tools (Read, Grep, Glob, safe Bash)
6. Writes findings to a new file in `.claude/coherence/decisions/`
7. Updates `.claude/coherence/understanding.md` with a brief synthesis
8. Returns a structured report of what was learned

If `.claude/coherence/` does not exist in the target repo, the first invocation creates it.

---

## Design thesis

Documentation is the only substrate where the complexity wall can be split infinitely. One file per decision, one file per question. Repeated invocations of this skill communicate only through the document tree — no shared state, no central orchestration. Sub-agents "spawn" by writing new question files for the next invocation to pick up.

This skill is the continuous continuation of `/bootstrap-project`:
- `/bootstrap-project` produces a one-shot snapshot (`.claude/specs/architecture.md`)
- `/coherence` maintains a living update (`.claude/coherence/` directory)

See `.claude/skills/coherence/SKILL.md` for the full specification, including workflow steps, substrate rules, edge cases, and extensibility plans.

---

## Examples

```bash
# Run a cycle against the current repo
/coherence

# Run a cycle against a specific project
/coherence /Users/kenny/playmakers-data

# Run a cycle against a repo that's new to the skill (first run = bootstrap)
/coherence /path/to/new-project
```

---

## First run vs. repeated runs

### First run on a repo
- Creates `.claude/coherence/` directory structure
- Scans the repo
- Generates initial questions
- Investigates the most fundamental one ("what is this project?" if no `.claude/BOOTSTRAP_REPORT.md` exists)
- Writes first decision file

### Repeated runs
- Reads prior state
- Scans for surface changes since last run
- Generates new questions about changes and gaps
- Picks the highest-priority unanswered question
- Investigates and writes one new decision file

**Invoke it as many times as you want.** Each cycle makes incremental progress. The architecture is designed so that repeated invocations compose — later cycles build on earlier ones through the document tree.

---

## Integration

- **With `/bootstrap-project`**: run bootstrap first on a new repo, then coherence for ongoing updates
- **With `schedule` skill**: schedule coherence to run hourly/daily for continuous updates without manual invocation
- **With hooks**: PostToolUse hooks can trigger coherence when new material is dropped into `.claude/coherence/sources/`

---

## Substrate rules (critical)

These rules govern how the skill writes to the document surface:

1. **One atomic unit per file** — never `decisions.md` with 50 entries; always `decisions/YYYY-MM-DD-slug.md` with one entry
2. **Cite sources always** — every claim must link to the file/line/commit that grounds it
3. **Sub-agents spawn through documents** — big questions decompose by writing sub-questions, not by spawning processes
4. **Write only inside `.claude/coherence/`** by default — broader write access requires explicit tool grants
5. **Idempotent** — running twice in a row must not duplicate work

---

## Success criteria

After a cycle, verify:
- [ ] `.claude/coherence/` exists and is populated
- [ ] `surface-map.md` has a recent timestamp
- [ ] `understanding.md` has at least one synthesis entry
- [ ] `decisions/` contains at least one well-cited finding
- [ ] `questions/` has open questions for the next cycle
- [ ] `.coherence-state.json` reflects the new invocation count

---

*Command Version: 0.1.0*
*Skill: `.claude/skills/coherence/SKILL.md`*
