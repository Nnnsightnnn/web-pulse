# Pain Points System Usage Guide

## Overview

The pain points tracking system helps identify and prioritize development friction areas by maintaining a living inventory of obstacles, inefficiencies, and technical debt.

## File Structure

```
.claude/pain-points/
├── active-pain-points.md       # Main tracking document
├── USAGE_GUIDE.md              # This file
└── archives/
    ├── YYYY-MM-resolved.md     # Monthly resolved items
    └── YYYY-QX-patterns.md     # Quarterly pattern analysis
```

## Weekly Review Process

### 1. Discovery Phase (15 min)

**Review recent work**:
- Look for phrases like "had to manually", "workaround", "blocked by"
- Note tasks that took longer than expected
- Identify recurring similar tasks

**Direct observation**:
- What slowed you down this week?
- What made you frustrated?
- What required a workaround?

### 2. Capture Phase (10 min)

Add new pain points using the template:

```markdown
### [PAIN-XXXX] Brief description (action-oriented)
- **Impact**: Specific scope (team/feature/process)
- **Frequency**: Daily/Weekly/Occasional with counts if known
- **First Noted**: YYYY-MM-DD
- **Context**: File paths, task IDs, specific scenarios
- **Workaround**: Current manual steps (helps quantify waste)
- **Potential Solution**: Initial ideas (can be rough)
- **Task**: Link if already created
```

### 3. Update Phase (5 min)

- Update frequency counts for existing items
- Adjust priorities based on new evidence
- Mark items as resolved if fixed this week
- Add notes about investigation progress

### 4. Prioritization Phase (10 min)

**Priority Matrix**:
```
         High Impact ↑
              |
   Critical  |  High
   ----------|----------
   Medium    |  Low
              |
              → High Frequency
```

**Re-prioritize based on**:
- Changed circumstances
- New evidence of frequency
- Business priorities
- Dependencies (blockers move up)

### 5. Action Phase (10 min)

**Identify 2-3 focus areas**:
- Quick wins (low effort, high impact)
- Strategic investments (high effort, very high impact)
- Investigations (need more data)

**Create tasks for prioritized items**.

## Monthly Maintenance

### Archive Resolved Items (Last day of month)

1. Create archive file: `.claude/pain-points/archives/YYYY-MM-resolved.md`
2. Move resolved items from "Recently Resolved" section
3. Add brief retrospective

**Archive Template**:
```markdown
# Resolved Pain Points - [Month Year]

**Resolved Count**: X
**Top Theme**: Brief description
**Biggest Win**: Most impactful resolution

## Items

### [PAIN-XXXX] Description
- **Resolved**: YYYY-MM-DD
- **Solution**: What fixed it
- **Impact**: Time saved or quality improved
- **Related**: Task or commit
```

## Quarterly Pattern Analysis

### Extract Patterns (End of quarter)

Create: `.claude/pain-points/archives/YYYY-QX-patterns.md`

**Analyze**:
1. What categories had most pain points?
2. What root causes appeared repeatedly?
3. What systemic issues emerged?
4. What architectural changes would help?

**Update memory system**:
- Add significant patterns to `.claude/memory/active/procedural-memory.md`

## ID Numbering System

- Start at `PAIN-0001` and increment sequentially
- IDs are never reused
- Archives preserve historical IDs
- Track last used ID at top of active document

## Integration Points

### With Git Commits
Reference pain points in commit messages: `"Fix: Improve deploy speed (PAIN-0023)"`

### With Memory System
- Pain point patterns update procedural memory
- Resolution patterns become documented solutions

## Tips for Effective Use

1. **Be Specific**: "Slow deployment" → "Deployment takes 8 min, 5 min is Docker layer caching"
2. **Quantify**: "Often" → "3-4 times per week"
3. **Focus on Frequency × Impact**: Rare but severe vs. daily but minor
4. **Separate Symptoms from Root Causes**: Track both but investigate root causes
5. **Don't Let It Grow Forever**: Regular archiving prevents overwhelm
6. **Link Evidence**: Point to specific tasks, commits, logs
7. **Update as You Learn**: Investigations often reveal the real issue

## Example Workflow

```bash
# Weekly review
1. Open active-pain-points.md
2. Review past week's work
3. Add 2-3 new pain points discovered
4. Update frequency on existing items
5. Mark resolved items
6. Identify top 2 focus areas
7. Create tasks for focus areas
8. Update "Next Review" date

# Monthly (last day)
1. Create archives/YYYY-MM-resolved.md
2. Move resolved items with retrospective
3. Clean up active document

# Quarterly (last week)
1. Create archives/YYYY-QX-patterns.md
2. Analyze themes and root causes
3. Update memory system patterns
```

## Common Mistakes to Avoid

- **Letting it become a complaint log**: Focus on actionable items
- **Too vague**: Need enough detail to act on
- **Ignoring low priority items**: They compound over time
- **Not tracking resolution**: Miss the win and learning
- **Perfectionism**: Rough notes are fine, refine as you learn

## Success Metrics

Track informally:
- Pain points resolved per month
- Time from first noted to resolution
- Pain points that led to significant improvements

---

This is a living guide. Update it as you discover better practices.
