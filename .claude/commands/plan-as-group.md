---
description: Collaborative solution planning with 3 technical experts
allowed-tools: Read, Write, Bash, Grep, Task
tags: [collaboration, planning, technical-review]
---

# Plan as Group

**Usage**: `/plan-as-group [problem description]`

Analyze problems collaboratively using 3 specialized experts to develop practical solutions.

---

## Overview

Quick collaborative planning that:
- Analyzes problems from multiple perspectives
- Creates initial solution with key details
- Gathers focused expert feedback
- Synthesizes into actionable plan

---

## Step 1: Setup Output Location

Create deliverable location:

```bash
mkdir -p docs/solutions/$(date +%Y%m%d_%H%M%S)
```

---

## Step 2: Initial Analysis

Lead developer analyzes: `$ARGUMENTS`

Create initial solution proposal:

```markdown
# Initial Solution

## Problem Statement
[Problem to solve]

## Proposed Approach
[High-level solution]

## Implementation Details
- Architecture:
- Technology Stack:
- Key Components:

## Success Metrics
[How we measure success]
```

---

## Step 3: Expert Reviews (Parallel)

Launch 3 expert agents in parallel:

### Backend/Data Expert
Focus areas:
- API design and data models
- Database optimization
- Performance and scalability
- Security considerations

### Frontend/UX Expert
Focus areas:
- UI/UX implementation
- Component architecture
- State management
- Accessibility

### Infrastructure Expert
Focus areas:
- Deployment strategy
- CI/CD pipeline
- Monitoring setup
- Cost optimization

Each expert reviews the initial solution and provides:
- Strengths
- Concerns
- Recommendations

---

## Step 4: Synthesis

Combine feedback into final solution:

```markdown
# Final Solution

## Executive Summary
[Brief overview]

## Technical Solution

### Architecture
[Agreed architecture]

### Implementation Plan
1. [Phase 1]
2. [Phase 2]
3. [Phase 3]

### Technology Choices
[Stack decisions]

## Risk Mitigation
[Key risks and how to address]

## Next Steps
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]
```

---

## Output Structure

```
docs/solutions/<timestamp>/
├── initial_solution.md     # Initial approach
├── expert_reviews.md       # Combined feedback
└── final_solution.md       # Synthesized plan
```

---

## Options

| Option | Effect |
|--------|--------|
| `--focus backend` | Emphasize backend review |
| `--focus frontend` | Emphasize frontend review |
| `--quick` | 2 experts only |
| `--no-save` | Don't save to files |

---

## Examples

```bash
# Full planning session
/plan-as-group Design authentication system with OAuth and MFA

# Quick planning
/plan-as-group --quick Add caching layer to API

# Frontend focus
/plan-as-group --focus frontend Redesign dashboard layout
```

---

## Success Criteria

1. Solution addresses core requirements
2. Expert feedback covers key concerns
3. Implementation plan is clear
4. Major risks identified

---

## Duration

- Quick mode: 3-5 minutes
- Full mode: 5-10 minutes

---

*Command Version: 1.0.0*
