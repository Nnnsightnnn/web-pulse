---
description: Launch parallel task execution
allowed-tools: Read, Grep, Glob, Task, TodoWrite
---

# Orchestrate Tasks

**Usage**: `/orchestrate-tasks`

Analyze available tasks and launch parallel execution for independent work.

---

## Step 1: Fetch Available Tasks

Query your task system for:
- Tasks assigned to you
- Status: "To-do" or "In Progress"
- Priority and dependencies

---

## Step 2: Dependency Analysis

For each task, determine:

### Independent Tasks (Can Parallelize)
- No blocking dependencies
- Different areas of codebase
- No shared state concerns

### Dependent Tasks (Must Serialize)
- Blocked by other tasks
- Shared file modifications
- Sequential workflow

### Groupable Tasks (Batch Together)
- Same module/area
- Related functionality
- Shared context

---

## Step 3: Build Execution Plan

```markdown
## Orchestration Plan

### Parallel Group 1 (Launch Together)
| Task | Area | Est. Time |
|------|------|-----------|
| Task A | /src/api | 30 min |
| Task B | /src/ui | 45 min |
| Task C | /tests | 20 min |

### Sequential (After Group 1)
| Task | Depends On | Area |
|------|------------|------|
| Task D | Task A | /src/api |

### Batched (Same Context)
| Task | Batch Reason |
|------|--------------|
| Task E | Same module |
| Task F | Same module |
```

---

## Step 4: Present for Approval

Show the execution plan and ask:

```
Ready to orchestrate:
- 3 tasks in parallel (Group 1)
- 1 task after completion (Sequential)
- 2 tasks batched together

Estimated total time: X minutes
(vs Y minutes if done sequentially)

Proceed? [Y/n]
```

---

## Step 5: Launch Agents

For approved parallel tasks, launch agents:

```yaml
# Launch in single message for true parallelism
Task 1:
  agent: general-purpose
  prompt: "Complete [Task A]: [description]"
  background: true

Task 2:
  agent: general-purpose
  prompt: "Complete [Task B]: [description]"
  background: true

Task 3:
  agent: general-purpose
  prompt: "Complete [Task C]: [description]"
  background: true
```

---

## Step 6: Monitor Progress

Track agent completion:
- Poll for status updates
- Collect results
- Handle failures

---

## Step 7: Report Results

```markdown
## Orchestration Results

### Completed
- ✅ Task A: [Summary]
- ✅ Task B: [Summary]
- ✅ Task C: [Summary]

### Failed (Needs Review)
- ❌ Task X: [Error]

### Time Saved
Sequential estimate: Y minutes
Actual time: X minutes
Saved: Z minutes (N% improvement)

### Next Steps
- Task D is now unblocked
- Review failed tasks
```

---

## Options

| Option | Effect |
|--------|--------|
| `--dry-run` | Show plan without executing |
| `--max=N` | Limit parallel agents to N |
| `--include-done` | Re-check completed tasks |
| `--area=X` | Filter to specific area |

---

## Examples

```bash
# Orchestrate all available tasks
/orchestrate-tasks

# Preview only
/orchestrate-tasks --dry-run

# Limit parallelism
/orchestrate-tasks --max=3

# Specific area
/orchestrate-tasks --area=frontend
```

---

## Safety Guidelines

### Do Parallelize
- Independent file changes
- Separate modules
- Test writing
- Documentation

### Don't Parallelize
- Same file modifications
- Database migrations
- Deployment steps
- Sequential workflows

---

## Fallback Mode

If task system unavailable:
- Use TodoWrite for tracking
- Manual task selection
- Proceed with orchestration

---

*Command Version: 1.0.0*
