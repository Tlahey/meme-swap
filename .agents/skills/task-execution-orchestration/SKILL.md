---
name: task-execution-orchestration
description: 'Orchestrate sub-agents for task execution and validate work via validation sub-agents. Use when: executing planned features, managing multi-agent workflows, or validating completed work against acceptance criteria.'
---

# Task Execution & Orchestration Skill

## Overview

This skill guides the execution of planned features by orchestrating sub-agents for task execution and validating the work via dedicated validation sub-agents.

**CRITICAL INPUT FORMAT**: This skill expects a JSON manifest from the `feature-planning` skill. The input should be a JSON structure containing feature details, tickets, subtasks, acceptance criteria, and validation requirements.

**CRITICAL EXECUTION METHOD**: You MUST use the `runSubagent` tool to execute subtasks. Do not directly implement code or make changes yourself. Always delegate task execution to appropriate sub-agents using the `runSubagent` tool, and use validation sub-agents to verify completed work against acceptance criteria.

## Step-by-Step Process

### 1. Orchestration Plan Review

**Input**: JSON planning manifest from the feature-planning skill

**Actions**:

- Parse the JSON planning manifest to understand the tickets and subtasks
- Identify the execution order based on dependencies
- Determine which tasks can be executed in parallel

**Output**: Execution plan with task ordering

### 2. Sub-Agent Assignment & Execution

For each subtask in the planning manifest JSON:

- **MUST use the `runSubagent` tool** to assign the appropriate sub-agent for execution based on the task type
- Provide the sub-agent with clear instructions and acceptance criteria via the `runSubagent` tool's prompt parameter
- Monitor the execution progress through the sub-agent's response

**Execution Order**:

- Sequential dependencies (what must run first)
- Parallelizable tasks (can be executed simultaneously using multiple `runSubagent` calls)

### 3. Validation Sub-Agent Assignment

For tasks requiring validation:

- Assign a validation sub-agent to verify the work
- Provide the validation sub-agent with the acceptance criteria and validation criteria from the JSON manifest
- Check for any validation failures

### 4. Orchestration Manifest Tracking

Track the status of each ticket and subtask using the following JSON structure:

```json
{
  "feature": "<Feature Name>",
  "tickets": [
    {
      "id": "TICKET-001",
      "title": "<Ticket Title>",
      "status": "in-progress | completed | failed",
      "subtasks": [
        {
          "id": "SUB-001-1",
          "title": "<Subtask Title>",
          "assignedAgent": "sub-agent",
          "validationAgent": "validation-sub-agent or null",
          "status": "not-started | in-progress | completed | failed",
          "validationStatus": "pending | passed | failed"
        }
      ]
    }
  ]
}
```

## Decision Points & Branching Logic

### When to Retry Failed Tasks

- **Retry**: For transient errors or incorrect implementation that can be fixed
- **Re-plan**: For fundamental misunderstandings of requirements or architectural issues

### Agent Assignment Rules

- **MUST use the `runSubagent` tool** for all task execution based on the nature of the work
- **MUST use the `runSubagent` tool** with validation sub-agents to verify completed work against acceptance criteria
- Never directly implement code or make changes yourself - always delegate to sub-agents via `runSubagent`

## Quality Criteria & Completion Checks

### For Orchestration Phase

- [ ] Execution graph correctly represents sequential and parallel tasks
- [ ] Each subtask has an assigned execution agent
- [ ] Validation requirements are specified for each task

### For Validation Phase

- [ ] Validation sub-agents have clear acceptance criteria from the JSON manifest
- [ ] All validation failures are tracked and can trigger re-execution
- [ ] Final feature integration is validated end-to-end

## Example Prompts to Try This Skill

1. "Execute the planned face swap feature tickets using sub-agents and validate the work"
2. "Orchestrate the execution of the Raycast extension tickets with validation steps"
3. "Execute the MCP server integration subtasks and validate against acceptance criteria"

## Related Skills

- **feature-planning**: For planning the features and breaking them down into tickets with subtasks in JSON format
