# Gantt

A [Claude Code](https://claude.ai/claude-code) plugin for project management — conversational planning, deterministic date sequencing, dependency tracking, and optional MS Project sync.

## Installation

### Via Marketplace

```bash
claude plugin marketplace add HurleySk/claude-plugins-marketplace
claude plugin install gantt
```

### Direct

```bash
claude plugin add HurleySk/claude-gantt-skill
```

## Skills

| Command | Description |
|---------|-------------|
| `/gantt:plan` | Conversational project init — iterative discovery, WBS decomposition, feasibility checks |
| `/gantt:schedule [cmd]` | Date sequencing — `sequence`, `critical-path`, `feasibility`, `shift`, `add`, `remove`, `holidays` |
| `/gantt:sync [cmd]` | MS Project bridge — `push`, `pull`, `status` (requires mpp-mcp) |

## How It Works

1. **Plan** your project conversationally — `/gantt:plan` walks backwards from your deadline, decomposes deliverables into tasks, wires dependencies, and checks feasibility
2. **Schedule** with precision — `/gantt:schedule sequence` runs a deterministic engine that computes dates (weekend and US federal holiday aware), resolves dependencies, and identifies the critical path
3. **Sync** to MS Project — `/gantt:sync push` exports to `.mpp` via mpp-mcp (optional)

State lives in `gantt-project.json` in your working directory. The engine (`engine/gantt-engine.js`) is zero-dependency Node.js.

## Skill-Engine Integration (Optional)

If you have the [skill-engine](https://github.com/HurleySk/skill-engine) plugin installed, copy the activation rules for auto-suggestions:

```bash
cp "$(claude plugin path gantt)/skill-rules.json" .claude/skill-rules.json
```

Or run `/skill-authoring:activation-setup analyze` to integrate with existing rules.

## License

MIT
