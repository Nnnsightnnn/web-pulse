# Memory System Contribution Guidelines

Essential rules for maintaining clean, scalable memory without bloat.

## Quick Rules

1. **Pattern Length**: 50-100 lines (target: 75 lines)
2. **Code Examples**: Max 2 per pattern (move rest to `/docs/`)
3. **Required Sections**: When/Success/Approach/Pitfalls/See Also/Metadata
4. **Full Documentation**: Create in `/docs/guides/patterns/` for complex patterns
5. **Target Sizes**: Quick-ref (10-20KB), Procedural (50-150KB), Total (<200KB)

---

## Pattern Template

### Standard Format (50-100 lines)

```markdown
## Pattern: [Name] ([Date])

### When to Use
- Trigger condition 1
- Trigger condition 2
- Use case scenario

### Success Metrics
- Measurable outcome 1
- Measurable outcome 2
- Verification method

### Core Approach

**Problem**: Brief description of what this solves

**Solution**: Essential steps only
1. Step 1 with key command/code
2. Step 2 with key command/code
3. Step 3 with key command/code

**Key Code Example** (max 1-2 examples):
```language
// Essential code only - 10-20 lines max
key_function() {
    critical_logic_here()
}
```

**Critical Rules**:
- DON'T: Anti-pattern
- DO: Best practice

### Common Pitfalls
- Pitfall 1: What goes wrong
- Pitfall 2: How to avoid

### See Also
- Full guide: `/docs/guides/patterns/{slug}.md`
- Related patterns: [PATTERN-ID]
- Tools: `path/to/tool`

<!-- metadata
created: YYYY-MM-DD
usage_count: 0
base_importance: 0.5-1.0
last_used: YYYY-MM-DD
category: [data-pipeline|deployment|debugging|performance|ui]
-->
```

---

## Size Limits

### Per-Pattern Limits
- **Minimum**: 30 lines (too short = incomplete)
- **Target**: 75 lines (optimal balance)
- **Maximum**: 100 lines (over = move to docs)

### Per-File Limits
- **quick-reference.md**: 10-20KB (top 20 patterns only)
- **procedural-memory.md**: 50-150KB (active patterns)
- **Total active memory**: <200KB (all files combined)

### When to Split
If pattern exceeds 100 lines:
1. Create full guide in `/docs/guides/patterns/`
2. Condense to 50-75 lines in procedural-memory.md
3. Link between them

---

## Memory Tiers

### Hot Tier: Quick Reference
**Criteria**: Top 20 most-used patterns
- Usage count >= 5
- Accessed in last 30 days
- Critical importance >= 0.8

### Warm Tier: Procedural Memory
**Criteria**: Active patterns
- All patterns with importance >= 0.7
- Recent patterns (<6 months old)
- Core development patterns

### Cool Tier: Structured Patterns
**Criteria**: Domain-specific consolidations
- Organized by domain
- Stable patterns
- Reference material

### Cold Tier: Documentation
**Criteria**: Complete guides
- Complex patterns
- Multiple code examples
- Full walkthroughs

---

## Metadata Requirements

Every pattern MUST include:

```markdown
<!-- metadata
created: YYYY-MM-DD          # Pattern creation date
usage_count: N               # Times referenced
base_importance: 0.0-1.0     # Importance score
last_used: YYYY-MM-DD        # Last access date
category: category-name      # Domain category
-->
```

### Importance Score Factors
- Critical keywords (critical, must, always): +0.1 each
- Well-structured (all sections present): +0.1
- Recent usage (last 30 days): +0.1
- Pattern length penalty (>150 lines): -0.1

---

## Memory Decay Formula

```python
memory_strength = base_importance × (1 / (1 + decay_rate × days_since_last_use))

# Boost factors:
# - Recent usage: +0.5
# - High usage count: +0.3
# - In quick-reference: +0.4

# Thresholds:
# - Keep if strength > 0.3
# - Archive if 0.1 < strength < 0.3
# - Remove if strength < 0.1
```

---

## Anti-Patterns

### DON'T:
1. **Mega-Patterns** (>100 lines) - Split into multiple or extract to docs
2. **Duplicate Patterns** - Search before adding, merge if similar
3. **Missing Sections** - Always include all required sections
4. **No Metadata** - Can't track usage without it
5. **Verbose Code** - Keep examples to 10-20 lines max

### DO:
1. **Concise Patterns** (50-100 lines) - Single focused purpose
2. **Consolidated Patterns** - Merge similar, cross-reference related
3. **Complete Sections** - All required sections present
4. **Rich Metadata** - All fields populated
5. **Linked Documentation** - Brief in memory, detailed in docs

---

## Workflow

### Adding a New Pattern

1. **Check if exists**: `grep -i "pattern.*keyword" .claude/memory/active/procedural-memory.md`
2. **Determine tier**: Hot/Warm/Cool/Cold based on usage expectations
3. **Use template**: Copy and fill all sections
4. **Create docs if complex**: `/docs/guides/patterns/{slug}.md`
5. **Test links**: Verify all cross-references work

### Updating Existing Pattern

1. **Preserve metadata**: Increment usage_count, update last_used
2. **Keep size in check**: If >100 lines, extract to docs
3. **Update cross-references**: If name changes, update all refs

### Removing Pattern

1. **Check usage**: Only if usage_count=0 and last_used >6 months
2. **Archive**: Move to `/docs/archive/`, don't delete
3. **Update refs**: Remove cross-references

---

## Maintenance Schedule

### Weekly
- Pattern usage tracking
- Metadata updates
- Decay calculations

### Monthly
- Review consolidation opportunities
- Archive old patterns
- Size check

### Quarterly
- Full memory audit
- Pattern similarity analysis
- Documentation sync

---

## Validation

Before committing changes:

```bash
# Check file sizes
ls -lh .claude/memory/active/*.md

# Count patterns
grep -c "^## Pattern:" .claude/memory/active/procedural-memory.md
```

Expected results:
- procedural-memory.md < 150KB
- All patterns have metadata
- No patterns >100 lines
- Total active memory <200KB

---

**Version**: 1.0.0
**Last Updated**: 2026-04-21
