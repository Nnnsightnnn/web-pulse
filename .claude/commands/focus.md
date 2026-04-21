---
description: Focus on a specific task with context loading
allowed-tools: Read, Grep, Glob, TodoWrite
---

# Focus Command

**Usage**: `/focus [task_id or description]`

Load context and concentrate on a specific task.

---

## Step 1: Identify Task

Parse the task identifier or description from: `$ARGUMENTS`

If a task ID is provided:
- Fetch task details from your task system
- Extract title, description, acceptance criteria

If a description is provided:
- Search for matching tasks
- Confirm the intended task

---

## Step 2: Load Memory Context

### 2.1 Check Quick Reference
```bash
# Read top patterns
cat .claude/memory/active/quick-reference.md
```

Look for patterns matching the task domain (deployment, debugging, data, etc.)

### 2.2 Check Pain Points
```bash
# Check for known blockers
cat .claude/pain-points/active-pain-points.md
```

Identify any active pain points that might affect this task.

### 2.3 Search Codebase
Based on task keywords, search for relevant files:
```bash
# Find related files
grep -r "keyword" --include="*.py" --include="*.js" | head -20
```

---

## Step 3: Build Context Summary

Present a focused context summary:

```markdown
## Task Focus: [Task Title]

### Objective
[What needs to be accomplished]

### Relevant Patterns
- [Pattern 1 from quick-reference]
- [Pattern 2 from quick-reference]

### Known Blockers
- [Pain point if applicable]

### Key Files
- `path/to/file1.py` - [Why relevant]
- `path/to/file2.js` - [Why relevant]

### Suggested Approach
1. [First step]
2. [Second step]
3. [Third step]
```

---

## Step 4: Create Task Tracking

If this is a multi-step task, initialize tracking:

```yaml
TodoWrite:
  - "Step 1: [First action]"
  - "Step 2: [Second action]"
  - "Step 3: [Verification]"
```

---

## Step 5: Begin Work

Start with the highest-priority subtask and maintain focus.

---

## Options

| Option | Effect |
|--------|--------|
| `--quick` | Skip memory search, just load task |
| `--deep` | Include structured patterns search |
| `--no-track` | Don't create TodoWrite entries |

---

## Examples

```bash
# Focus on a task by ID
/focus TASK-123

# Focus on a task by description
/focus "fix the login bug"

# Quick focus without memory search
/focus --quick TASK-456
```

---

## Error Handling

### Task Not Found
If unable to find the specified task:
1. List similar tasks
2. Ask for clarification
3. Offer to create a new task

### No Patterns Found
If no relevant patterns exist:
1. Note this is a new area
2. Suggest creating a pattern after completion
3. Proceed with investigation

---

*Command Version: 1.0.0*
