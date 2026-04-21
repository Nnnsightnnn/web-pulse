---
description: Multi-agent parallel investigation for complex problems
allowed-tools: Read, Grep, Glob, Task, Write
---

# Deep Investigation Command

**Usage**: `/deep-investigate [problem description or file:line reference]`

Multi-dimensional parallel investigation for sticky problems that resist simple debugging.

---

## When to Use

This command is for problems that:
- Have resisted initial debugging attempts
- Involve multiple systems or modules
- Exhibit non-deterministic behavior
- Have unclear root causes
- Need multiple perspectives to understand

---

## Step 1: Problem Characterization

### Gather Context
If `$ARGUMENTS` contains a file reference (e.g., `src/api.py:245`):
- Read the file and surrounding context
- Check git blame for recent changes
- Identify related modules

If `$ARGUMENTS` is a description:
- Search for related code patterns
- Identify affected systems
- List observable symptoms

### Characterization Questions
1. **Reproducibility**: Deterministic or intermittent?
2. **Scope**: Single module, cross-cutting, or system-wide?
3. **Symptoms**: What's the observable failure?
4. **Timeline**: When did this start? What changed?
5. **Attempted Fixes**: What's already been tried?

---

## Step 2: Select Investigation Dimensions

| Dimension | Focus | Best For |
|-----------|-------|----------|
| **Architecture** | Component boundaries, data flow | Integration issues |
| **State** | Mutable state, race conditions | Intermittent bugs |
| **Data** | Input validation, transformations | Wrong results |
| **Logic** | Conditional paths, edge cases | Wrong behavior |
| **Performance** | Bottlenecks, resource usage | Slow operations |
| **History** | Recent changes, regressions | "It used to work" |

### Selection Matrix
```
Problem Type          → Recommended Dimensions
─────────────────────────────────────────────────
Wrong calculation     → Logic + Data + History
Intermittent failure  → State + Architecture + Performance
Performance issue     → Performance + Architecture + Data
Integration bug       → Architecture + Data + State
"Works locally"       → Architecture + State + History
Data corruption       → Data + State + Logic
```

---

## Step 3: Launch Parallel Agents

**CRITICAL**: Launch ALL dimension agents in a SINGLE message for true parallelism.

### Agent Prompt Template

```yaml
Agent Type: Explore
Prompt: |
  # Deep Investigation Agent: [DIMENSION] Analysis

  ## Problem Context
  [Problem description]

  ## Your Focus
  [Dimension-specific questions]

  ## Files to Examine
  [Relevant files for this dimension]

  ## Output Format
  ### [DIMENSION] Investigation Report
  **Hypothesis**: [Main theory]
  **Confidence**: [High/Medium/Low]
  **Evidence**: [With file:line references]
  **Recommendations**: [Actions]
```

Launch 3-4 agents based on problem type.

---

## Step 4: Synthesize Findings

After all agents report:

1. **Identify Convergence**: Multiple agents pointing to same area
2. **Resolve Conflicts**: When agents disagree, investigate further
3. **Build Causal Chain**: Connect findings into root cause path
4. **Cross-Validate**: Ensure fix addresses all concerns

### Synthesis Template

```markdown
## Investigation Synthesis

### Convergence Points
- [Area where multiple agents found issues]

### Root Cause Hypothesis
Based on [Dimension 1] finding X and [Dimension 2] finding Y,
the root cause appears to be: [Root cause]

### Evidence Chain
1. [Initial trigger]
2. [Propagation path]
3. [Observable failure]

### Recommended Fix
- **Immediate**: [Quick fix]
- **Proper**: [Correct fix]
- **Prevention**: [Future prevention]

### Validation Steps
1. [How to verify fix]
2. [What to monitor]
```

---

## Step 5: Document and Track

Create investigation record:
```bash
mkdir -p .claude/investigations
# Save findings to timestamped file
```

Create follow-up tasks if needed.

---

## Options

| Option | Effect |
|--------|--------|
| `--dimensions=arch,state,data` | Limit to specific dimensions |
| `--quick` | 2 agents only (Logic + Data) |
| `--deep` | All 6 dimensions |
| `--dry-run` | Show plan without launching |

---

## Examples

```bash
# Investigate specific code location
/deep-investigate src/api/handler.py:245 - returns wrong data intermittently

# Investigate behavioral problem
/deep-investigate "login sometimes fails silently"

# Performance investigation
/deep-investigate "API response time degrading over time"

# Quick investigation
/deep-investigate --quick "validation not working"
```

---

## Troubleshooting Checklist

Before full investigation, check common issues:

### Request Hangs / Timeouts
1. Database locks
2. Async/sync mismatch
3. Resource exhaustion

### Silent Failures
1. Exception swallowing
2. Type errors
3. Missing error handlers

### "Works locally, fails in prod"
1. Environment differences
2. Configuration issues
3. Data differences

---

*Command Version: 1.0.0*
