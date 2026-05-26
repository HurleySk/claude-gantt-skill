---
name: sync
description: Use when pushing project data to a Microsoft Project .mpp file or pulling changes back from .mpp into gantt-project.json. Requires mpp-mcp MCP server.
argument-hint: "[push|pull|status|help] [path]"
---

# Sync — mpp-mcp Bridge

Bridges `gantt-project.json` and `.mpp` files via the mpp-mcp MCP server.

## Prerequisites

Before any command, check that mpp-mcp tools are available. Look for the `mcp__mpp-mcp__task` tool. If not found, stop and tell the user:

"mpp-mcp is not available in this session. Install it to enable .mpp sync: https://github.com/HurleySk/mpp-mcp"

Also read `gantt-project.json` from the working directory. If missing, tell the user: "No project found. Run `/gantt:kickoff` to create one."

## Commands

### `push [path]`

Export `gantt-project.json` to a `.mpp` file. Default path: `./<project-name>.mpp` (derived from project name, spaces replaced with hyphens, lowercased).

#### Step 1: Ensure dates are computed

Check if any task has `start: null`. If so, run `/gantt:schedule sequence` first. All tasks must have computed dates before pushing.

#### Step 2: Create or open the .mpp file

If the file doesn't exist:
```
mcp__mpp-mcp__file(action: 'create', path: '<absolute-path>')
```

If it exists:
```
mcp__mpp-mcp__file(action: 'open', path: '<absolute-path>')
```

Remember the `sessionId`.

#### Step 3: Create tasks in dependency order

Topological order (tasks with no dependencies first). For each task:

```
mcp__mpp-mcp__task(action: 'add', sessionId: '<id>', name: '<name>', duration: '<duration>', start: '<start>', finish: '<finish>', milestone: <bool>)
```

Remember each task's returned `uniqueId` mapped to the gantt task `id`.

#### Step 4: Build WBS hierarchy

Group tasks by `phase`. For each unique phase, the first task with that phase becomes the summary row. Indent subsequent tasks in the same phase:

```
mcp__mpp-mcp__task_move(action: 'indent', sessionId: '<id>', uniqueId: <child-uniqueId>)
```

#### Step 5: Wire dependencies

For each task with dependencies, using the uniqueId mapping from Step 3:

```
mcp__mpp-mcp__dependency(action: 'add', sessionId: '<id>', uniqueId: <successor-uniqueId>, predecessorUniqueId: <predecessor-uniqueId>, type: '<FS|FF|SS|SF>', lag: '<lag>')
```

#### Step 6: Close and save

```
mcp__mpp-mcp__file(action: 'close', sessionId: '<id>', save: true)
```

#### Step 7: Update metadata

Update `gantt-project.json`:
- Set `metadata.lastSyncedToMpp` to current ISO 8601 timestamp
- Set `metadata.lastModified` to current timestamp

Report: "Pushed [N] tasks to [path]. [N] dependencies wired."

### `pull [path]`

Import from a `.mpp` file into `gantt-project.json`.

#### Step 1: Open the file

```
mcp__mpp-mcp__file(action: 'open', path: '<absolute-path>')
```

#### Step 2: Read all tasks

```
mcp__mpp-mcp__tasks(action: 'list', sessionId: '<id>')
```

#### Step 3: Read dependencies for each task

For each task returned:

```
mcp__mpp-mcp__dependency(action: 'list', sessionId: '<id>', uniqueId: <uniqueId>)
```

#### Step 4: Read project info

```
mcp__mpp-mcp__project_info(sessionId: '<id>')
```

#### Step 5: Close without saving

```
mcp__mpp-mcp__file(action: 'close', sessionId: '<id>', save: false)
```

#### Step 6: Reconcile into gantt-project.json

Map mpp-mcp task data to the gantt schema:
- `uniqueId` -> `id` (prefix with `T` for tasks, `M` for milestones where duration is 0)
- `name` -> `name`
- `duration` -> `duration`
- `start` -> `start` (format as YYYY-MM-DD)
- `finish` -> `finish` (format as YYYY-MM-DD)
- `milestone` -> `milestone`
- `predecessors` string -> parse into `dependencies` array with type and lag
- `outlineLevel` > 1 -> derive `phase` from parent task name

Write `gantt-project.json`. Update metadata timestamps.

Report: "Pulled [N] tasks from [path]. Project: [name], [start] to [finish]."

### `status`

Compare `gantt-project.json` against the `.mpp` file. Derive path from project name or `metadata.lastSyncedToMpp`.

Open the .mpp (read-only), list tasks, compare counts and names. Close without saving. Report divergence:
- Tasks in JSON but not in .mpp
- Tasks in .mpp but not in JSON
- Tasks with different dates or durations
- Last sync timestamp

### `help`

| Command | Description |
|---------|-------------|
| `/gantt:sync push [path]` | Export gantt-project.json to .mpp |
| `/gantt:sync pull [path]` | Import .mpp into gantt-project.json |
| `/gantt:sync status` | Compare JSON vs .mpp state |
| `/gantt:sync help` | Show this help |

**Note:** All sync commands require the mpp-mcp MCP server. The .mpp file must be closed in MS Project before syncing.
