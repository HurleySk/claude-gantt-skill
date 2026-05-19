---
name: schedule
description: Use when sequencing project tasks, computing dates, analyzing critical path, checking feasibility against a deadline, or modifying an existing project schedule. Operates on gantt-project.json with a deterministic scheduling engine.
argument-hint: "[sequence|critical-path|feasibility|shift|add|remove|holidays|help] [args]"
---

# Schedule — Date Sequencing & Analysis

You operate on `gantt-project.json` in the working directory. All mutations re-run the engine and present results conversationally.

## Setup

Before any command, discover the engine:

```
Glob for `gantt-engine.js` under the plugin directory (two levels up from this SKILL.md). Remember as $ENGINE.
```

Read `gantt-project.json` from the working directory. If it doesn't exist, tell the user: "No project found. Run `/gantt:init` to create one."

## Commands

### `sequence` (default when no args)

Run the engine to resolve all dependencies and compute dates:

```bash
echo '{"command":"sequence","project":<gantt-project.json content>}' | node "$ENGINE"
```

On success, write the updated tasks (with computed start/finish dates) back to `gantt-project.json`. Update `metadata.lastModified`. Present the schedule as a table:

```
| ID | Task | Phase | Duration | Start | Finish |
```

Flag any warnings from the engine.

### `critical-path`

```bash
echo '{"command":"critical-path","project":<gantt-project.json content>}' | node "$ENGINE"
```

Present: project finish date, critical task count, then the critical chain with float values. Also show non-critical tasks with their float. Example:

"Critical path (17 working days): T1 (5d) -> T3 (10d) -> M2 (0d). T2 has 7 days of float."

### `feasibility [deadline]`

If a deadline argument is provided, temporarily override `project.deadline` in the JSON before sending to the engine. Otherwise use the project's existing deadline.

```bash
echo '{"command":"feasibility","project":<gantt-project.json content>}' | node "$ENGINE"
```

Present feasible/not feasible, float days, and critical tasks. If not feasible, suggest compression candidates (longest critical tasks).

### `shift <task-id> <duration>`

Read `gantt-project.json`. Find the task by ID. Add `<duration>` to its current duration (e.g., `shift T3 2d` adds 2 working days to T3's duration). Write back, then re-run `sequence`. Present a before/after comparison for all affected downstream tasks.

### `add <name> --after <id> --duration <dur>`

Generate the next available task ID (scan existing `T` IDs, increment). Create a new task with an FS dependency on `--after`. Run via engine:

```bash
echo '{"command":"add-task","project":<json>,"task":{"id":"<new>","name":"<name>","duration":"<dur>","dependencies":[{"id":"<after>","type":"FS","lag":"0d"}]}}' | node "$ENGINE"
```

Write the updated project back (engine returns the task, add it to the tasks array). Then re-run `sequence` and present the updated schedule.

### `remove <task-id>`

Read `gantt-project.json`. Remove the task. For any task that depended on the removed task, rewire: replace the removed task's ID in their dependencies with the removed task's own dependencies (transitive closure). Write back, re-run `sequence`, present the result.

### `holidays [start] [end]`

Default range: project start to project deadline (from `gantt-project.json`). If no project exists, use current calendar year.

```bash
echo '{"command":"holidays","startDate":"<start>","endDate":"<end>"}' | node "$ENGINE"
```

Present as a table: date, name, day of week.

### `help`

| Command | Description |
|---------|-------------|
| `/gantt:schedule` or `/gantt:schedule sequence` | Compute all dates from dependencies |
| `/gantt:schedule critical-path` | Show critical chain and float |
| `/gantt:schedule feasibility [deadline]` | Check plan against deadline |
| `/gantt:schedule shift <id> <dur>` | Slip a task, show cascade |
| `/gantt:schedule add <name> --after <id> --duration <dur>` | Add a task |
| `/gantt:schedule remove <id>` | Remove a task, rewire deps |
| `/gantt:schedule holidays [start] [end]` | List holidays in range |
| `/gantt:schedule help` | Show this help |
