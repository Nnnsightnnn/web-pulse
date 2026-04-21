# Procedural Memory

Active patterns and procedures for this project. Patterns here are accessed regularly and guide day-to-day work.

---

## Pattern Guidelines

### Pattern Size
- **Target**: 50-100 lines per pattern
- **Maximum**: 100 lines (move excess to `/docs/guides/patterns/`)
- **Minimum**: 30 lines (too short = incomplete)

### Required Sections
Every pattern must include:
1. When to Use
2. Success Metrics
3. Core Approach
4. Common Pitfalls
5. See Also
6. Metadata

### Adding New Patterns
1. Check if pattern already exists (search first)
2. Use the template below
3. Add appropriate metadata
4. Link to documentation if complex

---

## Pattern Template

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

**Problem**: Brief description

**Solution**:
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
base_importance: 0.5
last_used: YYYY-MM-DD
category: [category]
-->
```

---

## Active Patterns

*Add patterns here as you work on the project.*

### Deployment Domain

*Patterns related to deployment, CI/CD, and infrastructure*

### Data Domain

*Patterns related to data processing, pipelines, and validation*

### Development Domain

*Patterns related to coding, debugging, and testing*

### Performance Domain

*Patterns related to optimization, caching, and scaling*

---

## Pattern Index

| ID | Pattern Name | Category | Importance |
|----|--------------|----------|------------|
| - | (Add patterns as they emerge) | - | - |

---

## Maintenance

### Weekly Review
- Update usage_count for accessed patterns
- Promote frequently used patterns to quick-reference
- Archive patterns unused for 6+ months

### Monthly Consolidation
- Run memory consolidation skill
- Check file size (<150KB target)
- Merge similar patterns

---

**Last Updated**: 2026-04-21
**Pattern Count**: 0
**File Size Target**: <150KB
