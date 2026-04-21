# Memory Consolidation Skill

You are running the memory consolidation skill. Your goal is to maintain a clean, efficient memory system by identifying and resolving bloat, duplicates, and outdated patterns.

## Your Mission

Analyze the memory system and perform intelligent consolidation to keep total active memory under 200KB while preserving all valuable information.

## Phase 1: Analysis (REQUIRED FIRST)

### 1. Size Assessment
```bash
# Check current sizes
ls -lh .claude/memory/active/*.md
du -h .claude/memory/active/ | tail -1

# Count patterns
grep -c "^## Pattern:" .claude/memory/active/procedural-memory.md
```

**Evaluation**:
- procedural-memory.md > 150KB? → CRITICAL (immediate action)
- Total > 200KB? → HIGH (action needed)
- Individual patterns > 100 lines? → Flag for condensing

### 2. Pattern Analysis
Identify:
- Patterns >100 lines (verbose, need extraction)
- Patterns with similar names (potential duplicates)
- Patterns from >6 months ago with no usage (archive candidates)

### 3. Metadata Review
Check all patterns for:
- Missing metadata (add defaults)
- usage_count = 0 and old (archive candidates)
- last_used >3 months ago (decay candidates)

## Phase 2: Semantic Deduplication

### 1. Find Similar Patterns
Look for patterns with:
- Similar names
- Overlapping content
- Same domain/category

### 2. Propose Merges
For each pair with high similarity:
- Read both patterns
- Identify common content
- Plan merge strategy

## Phase 3: Pattern Extraction

### 1. Identify Verbose Patterns
Extract patterns >100 lines

### 2. Condense Each Pattern
For each verbose pattern:
- Keep max 2 code examples (10-20 lines each)
- Move detailed content to `/docs/guides/patterns/`
- Add "See Also" link to full documentation

### 3. Verify Quality
- Pattern still readable?
- Critical information preserved?
- Links working?
- Metadata intact?

## Phase 4: Memory Decay

### Calculate Decay Scores
```python
memory_strength = base_importance × (1 / (1 + decay_rate × days_since_last_use))

# Boost factors
if usage_count > 10: memory_strength += 0.3
if last_used < 30 days: memory_strength += 0.5
if in_quick_reference: memory_strength += 0.4
```

### Apply Thresholds
- strength > 0.7: Keep in procedural memory
- 0.3 < strength < 0.7: Review for archival
- strength < 0.3: Archive

## Phase 5: Execution

### 1. Backup First (CRITICAL)
```bash
cp .claude/memory/active/procedural-memory.md \
   .claude/memory/active/procedural-memory-backup-$(date +%Y%m%d).md
```

### 2. Apply Changes
- Merge duplicate patterns
- Replace verbose patterns with condensed versions
- Archive low-value patterns
- Update metadata

### 3. Verify Results
```bash
ls -lh .claude/memory/active/*.md
grep -c "^## Pattern:" .claude/memory/active/procedural-memory.md
```

## Phase 6: Reporting

### Generate Consolidation Report

```markdown
# Memory Consolidation Report - [Date]

## Summary
- **Before**: [SIZE]KB ([N] patterns)
- **After**: [SIZE]KB ([N] patterns)
- **Reduction**: [X]%

## Actions Taken

### Patterns Merged
1. Pattern A + Pattern B → Pattern A (Enhanced)

### Patterns Condensed
1. [Pattern Name]: [old] lines → [new] lines

### Patterns Archived
1. [Pattern Name] (last_used: X days ago)

## Recommendations
- Run consolidation monthly
- Monitor file sizes weekly
```

## Guidelines

### DO:
- Always backup before making changes
- Verify links after condensing patterns
- Preserve all valuable information
- Update metadata for all modified patterns
- Generate comprehensive report

### DON'T:
- Delete patterns without archiving
- Remove code examples without moving to docs
- Merge patterns with different use cases
- Skip metadata updates
- Make changes without backup

## Success Criteria

At completion:
- [ ] Total active memory <200KB
- [ ] No patterns >100 lines
- [ ] All patterns have metadata
- [ ] Consolidation report generated
- [ ] Backup created

## Configuration

- max_pattern_lines: 100
- similarity_threshold: 0.85
- importance_threshold: 0.3
- decay_rate: 0.1
- target_total_size_kb: 200

---

**Remember**: This is a maintenance task. Be thorough but don't rush. Quality over speed.

**Start with Phase 1 analysis before proceeding to consolidation.**
