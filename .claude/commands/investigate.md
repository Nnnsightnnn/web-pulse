---
description: Investigate a problem or question in the codebase
allowed-tools: Read, Grep, Glob, Task
---

# Investigate Command

**Usage**: `/investigate [question or problem]`

Search and analyze the codebase to answer questions or understand problems.

---

## Step 1: Clarify the Question

Parse the investigation target from: `$ARGUMENTS`

Determine the investigation type:
- **Code location**: "Where is X implemented?"
- **Behavior**: "How does X work?"
- **Problem**: "Why is X failing?"
- **Architecture**: "How do X and Y interact?"

---

## Step 2: Search Strategy

### 2.1 Keyword Search
```bash
# Search for relevant terms
grep -r "keyword" --include="*.py" --include="*.js" --include="*.ts"
```

### 2.2 File Pattern Search
```bash
# Find files by name pattern
find . -name "*keyword*" -type f
```

### 2.3 Definition Search
```bash
# Find class/function definitions
grep -r "class Keyword\|def keyword\|function keyword" --include="*.py" --include="*.js"
```

---

## Step 3: Analyze Findings

For each relevant file found:
1. Read the file content
2. Identify the specific section of interest
3. Trace dependencies and relationships
4. Note any patterns or conventions

---

## Step 4: Build Understanding

Create a mental model:
- Entry points
- Data flow
- Key components
- Edge cases

---

## Step 5: Present Findings

```markdown
## Investigation: [Question]

### Summary
[1-2 sentence answer]

### Key Findings

#### Finding 1: [Title]
- **Location**: `path/to/file.py:123`
- **Description**: [What was found]
- **Relevance**: [Why it matters]

#### Finding 2: [Title]
...

### Code Flow
1. [Entry point] (`file.py:10`)
2. [Processing] (`service.py:45`)
3. [Output] (`handler.py:78`)

### Recommendations
- [Action 1]
- [Action 2]

### Further Investigation
- [Open question 1]
- [Open question 2]
```

---

## Options

| Option | Effect |
|--------|--------|
| `--quick` | Single-pass search, brief summary |
| `--deep` | Multi-pass, follow all references |
| `--files-only` | Just list relevant files |

---

## Examples

```bash
# Find where something is implemented
/investigate "where is user authentication handled"

# Understand behavior
/investigate "how does the caching layer work"

# Debug a problem
/investigate "why are API responses slow"

# Quick search
/investigate --quick "database connection"
```

---

## Integration

After investigation, consider:
- `/focus [task]` - If this leads to a task
- `/deep-investigate` - If problem is complex
- Add pattern to memory if reusable insight

---

*Command Version: 1.0.0*
