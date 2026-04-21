---
description: Automate weekly sprint planning
allowed-tools: Bash, Read, Write, Edit, Glob, TodoWrite
---

# Sprint Planning

**Usage**: `/sprint-plan [week]`

Automate weekly sprint planning with task analysis and goal setting.

---

## Phase 1: Discovery

### 1.1 Determine Sprint Week
```bash
WEEK=${ARGUMENTS:-$(date +"%Y-W%V")}
```

### 1.2 Query Current Tasks
Fetch task status from your task system:
- Tasks in progress (measure WIP)
- Tasks in backlog (candidates)
- Recently completed (velocity)

### 1.3 Review Pain Points
Read `.claude/pain-points/active-pain-points.md`:
- Critical pain points (must address)
- High priority (should address)
- Recently resolved (celebrate wins)

### 1.4 Check Previous Sprint
Look for recent sprint documents:
- Last sprint's retrospective
- Carry-over tasks
- Patterns or blockers

---

## Phase 2: Analysis

### 2.1 Categorize by Track

Organize tasks into development tracks:

**Track 1: [Core Focus]**
- Primary business value tasks
- Feature development
- Bug fixes

**Track 2: [Infrastructure]**
- DevOps and tooling
- Technical debt
- Pain point resolution

**Track 3: [Innovation]**
- New features
- Experiments
- Improvements

### 2.2 Assess WIP

**WIP Guidelines**:
- ✅ Healthy: 3-5 tasks in progress
- ⚠️ Concerning: 6-8 tasks
- ❌ Overloaded: 9+ tasks

### 2.3 Pain Point Analysis

For each critical pain point:
- Does it have a task?
- What's the impact?
- Should it be prioritized?

---

## Phase 3: Planning Decisions

### 3.1 Sprint Goal Options

Present 2-3 goal options:

**Option A: Balanced**
- Goal: "[Balanced goal description]"
- Allocation: 33% each track
- Best when: No urgent priorities

**Option B: [Focused Area]**
- Goal: "[Focused goal description]"
- Allocation: 50% focus, 25%/25% others
- Best when: Urgent priority exists

**Option C: Custom**
- Define your own goal and allocation

### 3.2 Capacity Planning

Estimate available capacity:
- Hours available this week
- Account for meetings, interrupts
- Allocate to tracks

### 3.3 Task Selection

For each track, select tasks:
1. Must-do (critical, blocking)
2. Should-do (high value)
3. Nice-to-have (if time permits)

---

## Phase 4: Sprint Document

Generate sprint plan:

```markdown
# Sprint Plan: [Week]

## Sprint Goal
[Selected goal]

## Track Allocation
- Track 1: X% (Y hours)
- Track 2: X% (Y hours)
- Track 3: X% (Y hours)

## Selected Tasks

### Track 1: [Name]
- [ ] Task 1 (Priority, Size)
- [ ] Task 2 (Priority, Size)

### Track 2: [Name]
- [ ] Task 1 (Priority, Size)

### Track 3: [Name]
- [ ] Task 1 (Priority, Size)

## Pain Points to Address
- [PAIN-XXXX]: [Brief description]

## Carry-Over from Last Sprint
- [Task if any]

## Risks
- [Risk 1]
- [Risk 2]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
```

---

## Phase 5: Activation

### Create Tasks
For any new work identified, create tasks in your system.

### Update Pain Points
Link pain points to tasks.

### Commit Sprint Plan
Save to `.claude/sprints/` or your documentation location.

---

## Options

| Option | Effect |
|--------|--------|
| `--dry-run` | Show plan without creating tasks |
| `--quick` | Skip detailed analysis |
| `--retrospective` | Include last sprint review |

---

## Examples

```bash
# Plan current week
/sprint-plan

# Plan specific week
/sprint-plan 2025-W02

# With retrospective
/sprint-plan --retrospective

# Preview only
/sprint-plan --dry-run
```

---

## Customization

### Track Names
Edit this file to customize track names for your project:
- "Feature / Infrastructure / Experiment"
- "Product / Platform / Process"
- "Build / Fix / Improve"

### Allocation Defaults
Adjust default percentages based on project phase.

---

*Command Version: 1.0.0*
