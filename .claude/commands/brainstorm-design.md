---
description: Generate creative design concepts with research
allowed-tools: Read, WebSearch, mcp__perplexity__search
---

# Brainstorm Design

**Usage**: `/brainstorm-design [element or feature description]`

Generate creative UI/UX design concepts powered by research into current trends.

---

## Step 1: Understand Context

Parse the design target from: `$ARGUMENTS`

Gather context about:
- **What element/feature** needs design ideas
- **Where it appears** in the application
- **Current implementation** (if any)
- **Brand/style guidelines** (if defined)

---

## Step 2: Research Current Trends

### Use Perplexity or Web Search

**Research queries to run:**
1. **Trends**: "Best [element type] design trends 2025 web UI"
2. **Examples**: "[element type] design examples [industry] dashboard"
3. **Technical**: "CSS animation techniques for [effect type]"
4. **Inspiration**: "Award-winning [element type] designs"

**Extract from research:**
- Emerging design patterns
- Color and typography trends
- Animation techniques
- Accessibility considerations
- Performance best practices

---

## Step 3: Generate Design Concepts

Create **6-8 creative options** across categories:

### Animation Effects
- Motion and transitions
- Reveal/entrance effects
- Micro-interactions
- Loading states

### Visual Treatments
- Color schemes and gradients
- Typography approaches
- Iconography styles
- Texture and depth

### Layout Patterns
- Grid arrangements
- Card designs
- Information hierarchy
- Responsive considerations

### Interactive Elements
- Hover states
- Click feedback
- Scroll behaviors
- Gesture responses

---

## Step 4: Present Options

Each concept includes:

```markdown
## Design Brainstorm: [Element Name]

### Research Findings
- [Key trend 1]
- [Key trend 2]
- [Technical approach]

### Concepts

#### 1. [Concept Name] ⭐ (Research-Inspired)
**Description**: [What it does]
**Mood**: [Feeling it creates]
**Complexity**: Simple / Medium / Complex
**Inspired By**: [Source]

#### 2. [Concept Name]
**Description**: [What it does]
**Mood**: [Feeling it creates]
**Complexity**: Simple / Medium / Complex

[Continue for 6-8 concepts]

### Recommendation
[Which concept(s) best fit and why]

### Next Steps
Pick a number to explore, or describe a combination.
```

---

## Step 5: Explore Selected Concept

Once a direction is chosen:
1. Provide detailed implementation approach
2. Identify files to modify
3. Create CSS/JS code
4. Suggest variations and enhancements

---

## Options

| Option | Effect |
|--------|--------|
| `--quick` | Single query, fewer concepts |
| `--no-research` | Skip research, use existing knowledge |
| `--code` | Include implementation code |

---

## Examples

```bash
# Design a UI element
/brainstorm-design loading animation

# Design a feature
/brainstorm-design user profile card

# Quick brainstorm
/brainstorm-design --quick button hover effects

# With code
/brainstorm-design --code modal transitions
```

---

## Research Query Templates

| Element | Query Focus |
|---------|-------------|
| Animations | "CSS micro-interactions [type] 2025" |
| Cards | "Card UI design patterns dashboard" |
| Charts | "Data visualization trends" |
| Forms | "Modern form design UX" |
| Navigation | "Navigation patterns mobile-first" |
| Loading | "Skeleton loading progressive disclosure" |
| Modals | "Modal dialog accessibility" |
| Tables | "Data table responsive design" |

---

## Integration

After brainstorming:
- Create task if implementing
- Add pattern to memory if reusable
- Document in style guide if establishing standard

---

*Command Version: 1.0.0*
