---
name: feature-planning
description: 'Plan features by breaking them down into tickets with subtasks. Use when: planning complex features, creating task breakdowns, defining feature scope, or generating ticket structures with acceptance criteria.'
---

# Feature Planning Skill

## Overview

This skill guides the planning of complex features by breaking them down into manageable tickets with subtasks, defining scope, dependencies, and acceptance criteria.

**CRITICAL OUTPUT FORMAT**: The skill MUST return a JSON manifest that can be directly consumed by the `task-execution-orchestration` skill. The response should be succinct - only providing the points that need to be done for validation, without unnecessary explanations or conversational text.

## Step-by-Step Process

### 1. Feature Analysis & Scope Definition

**Input**: Feature description or user request

**Actions**:

- Understand the feature requirements and constraints
- Identify the main components or modules involved
- Determine the technology stack and dependencies
- Define success criteria and acceptance conditions

**Output**: Feature summary with clear boundaries

### 2. Task Breakdown into Tickets

For each major component, create a ticket structure with:

```
Ticket: [TICKET-ID] - [Brief Description]
Type: [Feature | Bugfix | Refactor | Chore | Infrastructure]
Priority: [High | Medium | Low]

Description:
[Detailed description of what needs to be done]

Subtasks:
- [ ] Subtask 1: [Description]
- [ ] Subtask 2: [Description]
- [ ] Subtask 3: [Description]

Dependencies:
- [List of tickets or subtasks that must be completed first]

Acceptance Criteria:
- [ ] Criterion 1
- [ ] Criterion 2

Validation Required: [Yes/No]
Validation Criteria: [What the validation should check]
```

### 3. Generate Planning Manifest (JSON OUTPUT)

Create a structured JSON manifest that can be consumed by the `task-execution-orchestration` skill:

```json
{
  "feature": "<Feature Name>",
  "description": "<Feature Description>",
  "tickets": [
    {
      "id": "TICKET-001",
      "title": "<Ticket Title>",
      "type": "<Type>",
      "priority": "<Priority>",
      "description": "<Description>",
      "subtasks": [
        {
          "id": "SUB-001-1",
          "title": "<Subtask Title>",
          "status": "not-started",
          "acceptanceCriteria": ["<criterion 1>", "<criterion 2>"]
        }
      ],
      "dependencies": ["<ticket-id or subtask-id>"],
      "status": "not-started",
      "validationRequired": true,
      "validationCriteria": ["<validation criterion 1>", "<validation criterion 2>"]
    }
  ]
}
```

## Output Format Requirements

**CRITICAL**: The response MUST be:
1. Succinct - only provide the points that need to be done for validation
2. JSON format - the planning manifest JSON should be the primary output
3. No conversational text or explanations outside the JSON
4. Include all acceptance criteria and validation requirements in the JSON structure

## Decision Points & Branching Logic

### When to Create Sub-Tickets vs Single Tickets

- **Sub-tickets**: When a task has distinct, separable work that requires independent validation or involves multiple components
- **Single ticket**: When the work is cohesive and can be completed as a unit

### When to Require Validation

- **Required**: For code quality, security, accessibility, and integration points
- **Optional**: For simple refactors or documentation updates

## Quality Criteria & Completion Checks

### For Planning Phase

- [ ] All feature requirements are captured and understood
- [ ] Tickets cover all necessary components
- [ ] Dependencies between tickets are correctly identified
- [ ] Subtasks are atomic and clearly defined
- [ ] Acceptance criteria are specific and testable
- [ ] JSON manifest is properly formatted and consumable by task-execution-orchestration

## Example Prompts to Try This Skill

1. "Plan the implementation of a new face swap feature with GIF upload and preview"
2. "Create a task breakdown for adding Raycast extension support"
3. "Break down the MCP server integration into tickets with subtasks and validation requirements"

## Related Skills

- **task-execution-orchestration**: For executing the planned tickets using sub-agents and validating the work
