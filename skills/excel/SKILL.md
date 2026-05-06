---
name: excel
description: Use when exporting project data to an Excel workbook, importing from Excel into gantt-project.json, or creating a fillable project template. Requires excel-mcp MCP server.
argument-hint: "[push|push-for-project|pull|status|template|help] [path]"
---

# Excel — Export, Import & Gantt Chart

Bridges `gantt-project.json` and Excel workbooks via the excel-mcp MCP server.

## Prerequisites

Before any command, check that excel-mcp tools are available. Look for the `mcp__excel-mcp__file` tool. If not found, stop:

"excel-mcp is not available in this session. Install it to enable Excel sync: https://github.com/HurleySk/excel-mcp"

Also read `gantt-project.json` from the working directory (except for `template` and `pull`, which don't require it).

## Commands

### `push [path]`

Export `gantt-project.json` to a formatted `.xlsx` workbook. Default path: `./<project-name>.xlsx` (project name lowercased, spaces to hyphens).

#### Step 1: Ensure dates are computed

Check if any task has `start: null`. If so: "Tasks need dates first. Running `/gantt:schedule sequence`..." and invoke it.

#### Step 2: Agent mode

Present two choices:
1. **"Watch me work"** — Show Excel side-by-side. Slightly slower.
2. **"Work in background"** — Hidden, faster.

Skip asking for projects with fewer than 5 tasks — default to background.

#### Step 3: Create or open file

If file doesn't exist:
```
mcp__excel-mcp__file(action: 'create', path: '<absolute-path>', show: <true if watch mode>)
```
If it exists:
```
mcp__excel-mcp__file(action: 'open', path: '<absolute-path>', show: <true if watch mode>)
```
Remember `session_id`.

If watch mode:
```
mcp__excel-mcp__window(action: 'arrange', session_id: '<id>', preset: 'right-half')
mcp__excel-mcp__window(action: 'set-status-bar', session_id: '<id>', text: 'Gantt: pushing project schedule...')
```

#### Step 4: Set manual calculation

```
mcp__excel-mcp__calculation_mode(action: 'set-mode', session_id: '<id>', mode: 'Manual')
```

#### Step 5: Create sheets

```
mcp__excel-mcp__worksheet(action: 'rename', session_id: '<id>', old_name: 'Sheet1', new_name: 'Schedule')
mcp__excel-mcp__worksheet(action: 'create', session_id: '<id>', sheet_name: 'Project Info')
```

#### Step 6: Write schedule data

Build a 2D array. Row 0 = headers, rows 1-N = task data.

**Headers:** `['ID', 'Task Name', 'Phase', 'Duration', 'Start', 'Finish', 'Dependencies', 'Status', 'Notes']`

**Dependency serialization:** Convert `[{"id":"T1","type":"FS","lag":"0d"}]` to human-readable:
- FS with 0 lag: just `"T1"`
- FS with lag: `"T1 +2d"`
- Non-FS: `"T1 SS"` or `"T1 FF +1d"`
- Multiple: comma-separated: `"T1, T3 SS +1d"`

```
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A1:I{N+1}', values: [[headers], [row1], ...])
```

#### Step 7: Create structured table

```
mcp__excel-mcp__table(action: 'create', session_id: '<id>', sheet_name: 'Schedule', table_name: 'GanttSchedule', range_address: 'A1:I{N+1}', has_headers: true)
mcp__excel-mcp__table(action: 'set-style', session_id: '<id>', table_name: 'GanttSchedule', table_style: 'TableStyleMedium2')
```

#### Step 8: Format columns

Date columns:
```
mcp__excel-mcp__table_column(action: 'set-column-number-format', session_id: '<id>', table_name: 'GanttSchedule', column_name: 'Start', format_code: 'yyyy-mm-dd')
mcp__excel-mcp__table_column(action: 'set-column-number-format', session_id: '<id>', table_name: 'GanttSchedule', column_name: 'Finish', format_code: 'yyyy-mm-dd')
```

Auto-fit then set minimum widths:
```
mcp__excel-mcp__range_format(action: 'auto-fit-columns', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A:I')
mcp__excel-mcp__range_format(action: 'set-column-width', session_id: '<id>', sheet_name: 'Schedule', range_address: 'B:B', column_width: 40)
mcp__excel-mcp__range_format(action: 'set-column-width', session_id: '<id>', sheet_name: 'Schedule', range_address: 'I:I', column_width: 30)
```

Wrap text on Notes column:
```
mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Schedule', range_address: 'I2:I{N+1}', wrap_text: true)
```

#### Step 9: Conditional formatting

Apply to data body `A2:I{N+1}`:

Milestones:
```
mcp__excel-mcp__conditionalformat(action: 'add-rule', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A2:I{N+1}', rule_type: 'expression', formula1: '=$D2="0d"', interior_color: '#FFF2CC', font_bold: true)
```

Status completed:
```
mcp__excel-mcp__conditionalformat(action: 'add-rule', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A2:I{N+1}', rule_type: 'expression', formula1: '=$H2="completed"', font_color: '#548235', font_italic: true)
```

Status in_progress:
```
mcp__excel-mcp__conditionalformat(action: 'add-rule', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A2:I{N+1}', rule_type: 'expression', formula1: '=$H2="in_progress"', interior_color: '#D6E4F0')
```

#### Step 10: Write Project Info sheet

```
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1', values: [[project.name]])
mcp__excel-mcp__range_format(action: 'merge-cells', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1:D1')
mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1:D1', bold: true, font_size: 16)
```

Write label/value pairs:
```
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A3:B8', values: [
  ['Description', project.description],
  ['', ''],
  ['Start Date', project.startDate],
  ['Deadline', project.deadline],
  ['Working Days', project.workingDays.join(', ')],
  ['Holidays', project.holidays]
])
```

Bold labels:
```
mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A3:A20', bold: true)
```

Write assumptions:
```
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A10', values: [['Assumptions']])
```
Then one assumption per row starting at A11.

Auto-fit:
```
mcp__excel-mcp__range_format(action: 'auto-fit-columns', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A:D')
```

#### Step 11: Tab colors

```
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Schedule', red: 84, green: 130, blue: 53)
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Project Info', red: 68, green: 114, blue: 196)
```

#### Step 12: Optional Gantt chart

Ask: "Add a Gantt chart visualization? (Adds a timeline bar chart on a separate sheet.)"

If yes, create the Gantt chart:

**Create sheet and helper data:**
```
mcp__excel-mcp__worksheet(action: 'create', session_id: '<id>', sheet_name: 'Gantt Chart')
```

Build a helper data range on the Gantt Chart sheet. Tasks in **reverse order** (chart renders bottom-up). Columns:

| A: Task | B: Start Offset | C: Duration |
|---------|----------------|-------------|
| `"T1: Task Name"` | calendar days from project start to task start | numeric duration in working days |

For milestones (duration 0), use 0.3 in column C so they appear as thin slivers.

Compute Start Offset as: `(task start date - project start date)` in calendar days. This is simple date subtraction — no working-day math needed for the visualization axis.

```
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Gantt Chart', range_address: 'A1:C{N+1}', values: [['Task', 'Start Offset', 'Duration'], ...reversed task rows...])
```

**Create chart:**
```
mcp__excel-mcp__chart(action: 'create-from-range', session_id: '<id>', sheet_name: 'Gantt Chart', chart_type: 'BarStacked', source_range_address: "'Gantt Chart'!A1:C{N+1}", chart_name: 'GanttTimeline', target_range: 'E1:T{max(25, N+5)}')
```

**Configure chart:**

Title:
```
mcp__excel-mcp__chart_config(action: 'set-title', session_id: '<id>', chart_name: 'GanttTimeline', title: '{project name} — Timeline')
```

Make Start Offset series invisible (series 1). Try setting fill to white first:
```
mcp__excel-mcp__chart_config(action: 'set-series-format', session_id: '<id>', chart_name: 'GanttTimeline', series_index: 1, marker_foreground_color: '#FFFFFF', marker_background_color: '#FFFFFF')
```

If the Start Offset bars are still visible (check via screenshot), fall back to VBA:
```
mcp__excel-mcp__vba(action: 'import', session_id: '<id>', module_name: 'GanttHelper', vba_code: 'Sub HideStartOffset()\n  ActiveSheet.ChartObjects("GanttTimeline").Chart.SeriesCollection(1).Format.Fill.Visible = msoFalse\n  ActiveSheet.ChartObjects("GanttTimeline").Chart.SeriesCollection(1).Format.Line.Visible = msoFalse\nEnd Sub')
mcp__excel-mcp__vba(action: 'run', session_id: '<id>', module_name: 'GanttHelper', procedure_name: 'HideStartOffset')
mcp__excel-mcp__vba(action: 'delete', session_id: '<id>', module_name: 'GanttHelper')
```

Note: VBA requires .xlsm format. If the file is .xlsx, use `file(action: 'save_as')` to save as .xlsm before VBA, then save back as .xlsx after. Or accept the white-fill approach for .xlsx files.

Color Duration series (series 2):
```
mcp__excel-mcp__chart_config(action: 'set-series-format', session_id: '<id>', chart_name: 'GanttTimeline', series_index: 2, marker_foreground_color: '#4472C4', marker_background_color: '#4472C4')
```

Hide legend:
```
mcp__excel-mcp__chart_config(action: 'show-legend', session_id: '<id>', chart_name: 'GanttTimeline', visible: false)
```

Value axis (horizontal):
```
mcp__excel-mcp__chart_config(action: 'set-axis-title', session_id: '<id>', chart_name: 'GanttTimeline', axis: 'Value', title: 'Days from Project Start')
mcp__excel-mcp__chart_config(action: 'set-axis-scale', session_id: '<id>', chart_name: 'GanttTimeline', axis: 'Value', minimum_scale: 0)
```

Gridlines:
```
mcp__excel-mcp__chart_config(action: 'set-gridlines', session_id: '<id>', chart_name: 'GanttTimeline', axis: 'Value', show_major: true, show_minor: false)
```

Tab color:
```
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Gantt Chart', red: 192, green: 0, blue: 0)
```

For projects with <= 20 tasks, add data labels on Duration bars:
```
mcp__excel-mcp__chart_config(action: 'set-data-labels', session_id: '<id>', chart_name: 'GanttTimeline', show_value: true, label_position: 'InsideEnd')
```

#### Step 13: Finalize

```
mcp__excel-mcp__calculation_mode(action: 'calculate', session_id: '<id>', scope: 'Workbook')
mcp__excel-mcp__calculation_mode(action: 'set-mode', session_id: '<id>', mode: 'Automatic')
```

Screenshot for verification:
```
mcp__excel-mcp__screenshot(action: 'capture-sheet', session_id: '<id>', sheet_name: 'Schedule', quality: 'Medium')
```

Present screenshot to user.

```
mcp__excel-mcp__window(action: 'clear-status-bar', session_id: '<id>')
mcp__excel-mcp__file(action: 'close', session_id: '<id>', save: true)
```

#### Step 14: Update metadata

Update `gantt-project.json`:
- Set `metadata.lastSyncedToExcel` to current ISO 8601 timestamp
- Set `metadata.lastModified` to current timestamp

Report: "Pushed [N] tasks to [path]. [milestone count] milestones, [dep count] dependencies. Schedule table with conditional formatting applied."

---

### `pull [path]`

Import from an Excel file into `gantt-project.json`.

#### Step 1: Open file

```
mcp__excel-mcp__file(action: 'open', path: '<absolute-path>', show: false)
```

#### Step 2: Discover data structure

Try to find the structured table first:
```
mcp__excel-mcp__table(action: 'list', session_id: '<id>')
```

**Path A — `GanttSchedule` table found:**
```
mcp__excel-mcp__table(action: 'get-data', session_id: '<id>', table_name: 'GanttSchedule')
```
Column mapping is direct: ID, Task Name, Phase, Duration, Start, Finish, Dependencies, Status, Notes.

**Path B — No table (generic Excel format):**
```
mcp__excel-mcp__worksheet(action: 'list', session_id: '<id>')
mcp__excel-mcp__range(action: 'get-used-range', session_id: '<id>', sheet_name: '<first sheet>')
mcp__excel-mcp__range(action: 'get-values', session_id: '<id>', sheet_name: '<sheet>', range_address: '<used range>')
```

Scan the header row (row 1) for common column names (case-insensitive):

| Pattern | Maps to |
|---------|---------|
| "id", "task id", "#" | id |
| "task", "task name", "name", "activity" | name |
| "phase", "wbs", "group", "category" | phase |
| "duration", "dur", "effort" | duration |
| "start", "start date", "begin" | start |
| "finish", "end", "end date", "finish date" | finish |
| "predecessors", "dependencies", "deps", "pred" | dependencies |
| "status", "state", "progress" | status |
| "notes", "comments", "description" | notes |

If a required column (name, duration) is not found, ask the user to specify the mapping.

#### Step 3: Parse dependencies

Handle multiple formats per dependency segment:
- Gantt format: `"T1 FS +2d"`, `"T3 SS"`, `"T1"`
- MS Project style: `"1"`, `"1FS"`, `"1SS+2d"`
- Simple list: `"T1, T2"` (assume FS, 0 lag)

Parse regex per comma-separated segment: `/^\s*([TM]?\d+)\s*(FS|FF|SS|SF)?\s*([+-]\d+[dwh])?\s*$/i`

If ID is purely numeric (no T/M prefix), prefix with `T`.
Default type: `FS`. Default lag: `0d`.

#### Step 4: Parse dates

Excel may return dates as serial numbers (e.g., 45678) or strings. If numeric: convert from Excel serial date to YYYY-MM-DD. Formula: `date = new Date((serial - 25569) * 86400000)`. If string: parse directly.

#### Step 5: Parse durations

If plain number (e.g., `5`), append `d`. If `"5 days"`, convert to `"5d"`. If `"2 weeks"`, convert to `"2w"`.

#### Step 6: Read Project Info

```
mcp__excel-mcp__worksheet(action: 'list', session_id: '<id>')
```

If "Project Info" sheet exists:
```
mcp__excel-mcp__range(action: 'get-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1:D20')
```
Map: A1=name, B3=description, B5=startDate, B6=deadline, B7=workingDays, B8=holidays, A11+=assumptions.

If not found: derive project name from filename, startDate/deadline from earliest start and latest finish across tasks. Ask user for project name if unsure.

#### Step 7: Generate IDs if missing

If source data lacks an ID column, auto-generate: `T1`, `T2`, ... for tasks (duration > 0), `M1`, `M2`, ... for milestones (duration = 0d).

#### Step 8: Close file

```
mcp__excel-mcp__file(action: 'close', session_id: '<id>', save: false)
```

#### Step 9: Write gantt-project.json

If `gantt-project.json` already exists, ask: "Project already exists ([name], [N] tasks). Overwrite with Excel data, or cancel?"

Construct full JSON using the gantt schema. Set:
- `metadata.createdBy`: `"gantt:excel pull"` (if new) or keep existing
- `metadata.lastSyncedToExcel`: current ISO 8601 timestamp
- `metadata.lastModified`: current timestamp
- `metadata.engineVersion`: `"1.0.0"`
- `project.workingDays`: default `["Mon","Tue","Wed","Thu","Fri"]` if not found
- `project.holidays`: default `"us-federal"` if not found

Write the file.

Report: "Pulled [N] tasks from [path]. Project: [name], [start] to [finish]. [N] dependencies mapped. Run `/gantt:schedule sequence` to compute dates from dependencies."

---

### `status`

Compare `gantt-project.json` against the Excel file.

#### Step 1: Read gantt-project.json

Derive Excel path from project name (`./<name>.xlsx`) or check if `metadata.lastSyncedToExcel` context suggests a path.

#### Step 2: Open and read Excel

```
mcp__excel-mcp__file(action: 'open', path: '<path>', show: false)
mcp__excel-mcp__table(action: 'get-data', session_id: '<id>', table_name: 'GanttSchedule')
```

If no table, fall back to `range(get-used-range)` + `range(get-values)`.

#### Step 3: Compare

Build comparison by task ID:
- Tasks in JSON but not in Excel
- Tasks in Excel but not in JSON
- Tasks with different values (name, duration, start, finish, status)
- Total counts

#### Step 4: Close and report

```
mcp__excel-mcp__file(action: 'close', session_id: '<id>', save: false)
```

Present a formatted table of divergences. Summary: "JSON: [N] tasks, Excel: [M] tasks. [X] matching, [Y] divergent. Last synced: [timestamp]."

---

### `template [path]`

Create a blank, fillable Excel workbook for manual project entry.

Default path: `./project-template.xlsx`.

#### Step 1: Create file

```
mcp__excel-mcp__file(action: 'create', path: '<absolute-path>', show: true)
```

#### Step 2: Build Schedule sheet

Rename default sheet, write headers + one example row:

```
mcp__excel-mcp__worksheet(action: 'rename', session_id: '<id>', old_name: 'Sheet1', new_name: 'Schedule')
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A1:I2', values: [
  ['ID', 'Task Name', 'Phase', 'Duration', 'Start', 'Finish', 'Dependencies', 'Status', 'Notes'],
  ['T1', 'Example Task', 'Phase 1', '5d', '', '', '', 'not_started', 'Delete this row and add your tasks']
])
```

Create table:
```
mcp__excel-mcp__table(action: 'create', session_id: '<id>', sheet_name: 'Schedule', table_name: 'GanttSchedule', range_address: 'A1:I2', has_headers: true)
mcp__excel-mcp__table(action: 'set-style', session_id: '<id>', table_name: 'GanttSchedule', table_style: 'TableStyleMedium2')
```

Date formats:
```
mcp__excel-mcp__table_column(action: 'set-column-number-format', session_id: '<id>', table_name: 'GanttSchedule', column_name: 'Start', format_code: 'yyyy-mm-dd')
mcp__excel-mcp__table_column(action: 'set-column-number-format', session_id: '<id>', table_name: 'GanttSchedule', column_name: 'Finish', format_code: 'yyyy-mm-dd')
```

Data validation on Status:
```
mcp__excel-mcp__range_format(action: 'validate-range', session_id: '<id>', sheet_name: 'Schedule', range_address: 'H2:H1000', validation_type: 'list', formula1: 'not_started,in_progress,completed', show_input_message: true, input_title: 'Status', input_message: 'Choose: not_started, in_progress, or completed', show_error_alert: true, error_title: 'Invalid Status', error_message: 'Must be: not_started, in_progress, or completed', error_style: 'Stop')
```

Duration input hint:
```
mcp__excel-mcp__range_format(action: 'validate-range', session_id: '<id>', sheet_name: 'Schedule', range_address: 'D2:D1000', validation_type: 'textLength', validation_operator: 'greaterThanOrEqual', formula1: '2', show_input_message: true, input_title: 'Duration', input_message: 'Format: 5d (days), 2w (weeks), 8h (hours). Milestones: 0d')
```

Auto-fit + minimum widths:
```
mcp__excel-mcp__range_format(action: 'auto-fit-columns', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A:I')
mcp__excel-mcp__range_format(action: 'set-column-width', session_id: '<id>', sheet_name: 'Schedule', range_address: 'B:B', column_width: 40)
```

#### Step 3: Build Project Info sheet

```
mcp__excel-mcp__worksheet(action: 'create', session_id: '<id>', sheet_name: 'Project Info')
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1', values: [['Project Name']])
mcp__excel-mcp__range_format(action: 'merge-cells', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1:D1')
mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A1:D1', bold: true, font_size: 16, font_color: '#808080')

mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A3:B8', values: [
  ['Description', ''],
  ['', ''],
  ['Start Date', ''],
  ['Deadline', ''],
  ['Working Days', 'Mon, Tue, Wed, Thu, Fri'],
  ['Holidays', 'us-federal']
])

mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A3:A20', bold: true)
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A10', values: [['Assumptions']])
mcp__excel-mcp__range_format(action: 'auto-fit-columns', session_id: '<id>', sheet_name: 'Project Info', range_address: 'A:D')
```

#### Step 4: Tab colors and save

```
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Schedule', red: 84, green: 130, blue: 53)
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Project Info', red: 68, green: 114, blue: 196)
mcp__excel-mcp__file(action: 'close', session_id: '<id>', save: true)
```

Report: "Template created at [path]. Fill in your tasks and project info, then run `/gantt:excel pull [path]` to import."

---

### `push-for-project [path]`

Export `gantt-project.json` to an `.xlsx` workbook formatted for **direct import into Microsoft Project**. Default path: `./<project-name>-for-project.xlsx`.

MS Project can open this file via File → Open and will recognize the column names, predecessor format, and outline levels natively.

#### Differences from `push`

| Aspect | `push` | `push-for-project` |
|--------|--------|---------------------|
| ID column | Task IDs (`T1`, `M1`) | Row numbers (`1`, `2`, `3`) |
| Dependencies header | `Dependencies` | `Predecessors` |
| Dep format | `T1, T3 SS +1d` | `1,3SS+1d` |
| Status column | `Status` (`in_progress`) | `% Complete` (`0`, `50`, `100`) |
| Extra column | — | `Outline Level` |
| Excel Table | Yes (`GanttSchedule`) | No (raw range — Project handles tables inconsistently) |
| Gantt Chart sheet | Yes | No (Project generates its own) |

#### Step 1: Ensure dates are computed

Same as `push` — check for `start: null`, run sequence if needed.

#### Step 2: Agent mode

Same as `push`.

#### Step 3: Create or open file

Same as `push`.

#### Step 4: Set manual calculation

Same as `push`.

#### Step 5: Create sheets

```
mcp__excel-mcp__worksheet(action: 'rename', session_id: '<id>', old_name: 'Sheet1', new_name: 'Schedule')
mcp__excel-mcp__worksheet(action: 'create', session_id: '<id>', sheet_name: 'Project Info')
```

#### Step 6: Build and write schedule data

**Headers:** `['ID', 'Task Name', 'Duration', 'Start', 'Finish', 'Predecessors', '% Complete', 'Outline Level', 'Notes']`

**Build a task ID → row number map** before serializing. Tasks appear in the same order as `gantt-project.json`. The first task is row number 1, second is 2, etc. (Row numbers are 1-based, matching the data rows in Excel — header is row 0 in the array but row 1 in the sheet.)

**ID column**: Use the row number (1, 2, 3...), not the task ID.

**Predecessor serialization** (MS Project format):
- Look up each dependency's task ID in the row-number map
- FS + 0 lag: just the row number → `"1"`
- FS + non-zero lag: `"1+2d"` (no space before `+`)
- Non-FS + 0 lag: `"1SS"` (type concatenated, no space)
- Non-FS + non-zero lag: `"1SS+2d"`
- Multiple predecessors: comma-separated, no spaces → `"1,3SS+1d"`

**% Complete mapping**:
- `not_started` → `0`
- `in_progress` → `50`
- `completed` → `100`

**Outline Level**: Assign based on phase grouping. Track the current phase — each time the phase changes, that's a new group. All tasks get outline level `2`. Optionally, you could insert phase summary rows at level `1`, but this complicates the row-number mapping. Simpler: just set all tasks to level `1` (flat) and let the user indent in Project if desired.

```
mcp__excel-mcp__range(action: 'set-values', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A1:I{N+1}', values: [[headers], [row1], ...])
```

**Do NOT create an Excel Table.** MS Project's import wizard handles structured tables inconsistently.

#### Step 7: Format columns

Bold header row:
```
mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A1:I1', bold: true, fill_color: '#4472C4', font_color: '#FFFFFF')
```

Date columns:
```
mcp__excel-mcp__range(action: 'set-number-format', session_id: '<id>', sheet_name: 'Schedule', range_address: 'D2:E{N+1}', format_code: 'yyyy-mm-dd')
```

Auto-fit then set minimum widths:
```
mcp__excel-mcp__range_format(action: 'auto-fit-columns', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A:I')
mcp__excel-mcp__range_format(action: 'set-column-width', session_id: '<id>', sheet_name: 'Schedule', range_address: 'B:B', column_width: 40)
mcp__excel-mcp__range_format(action: 'set-column-width', session_id: '<id>', sheet_name: 'Schedule', range_address: 'I:I', column_width: 30)
```

Wrap text on Notes:
```
mcp__excel-mcp__range_format(action: 'format-range', session_id: '<id>', sheet_name: 'Schedule', range_address: 'I2:I{N+1}', wrap_text: true)
```

#### Step 8: Conditional formatting

Milestones (duration = "0d"):
```
mcp__excel-mcp__conditionalformat(action: 'add-rule', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A2:I{N+1}', rule_type: 'expression', formula1: '=$C2="0d"', interior_color: '#FFF2CC')
```

Completed (100%):
```
mcp__excel-mcp__conditionalformat(action: 'add-rule', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A2:I{N+1}', rule_type: 'expression', formula1: '=$G2=100', font_color: '#548235')
```

In progress (50%):
```
mcp__excel-mcp__conditionalformat(action: 'add-rule', session_id: '<id>', sheet_name: 'Schedule', range_address: 'A2:I{N+1}', rule_type: 'expression', formula1: '=$G2=50', interior_color: '#D6E4F0')
```

#### Step 9: Write Project Info sheet

Same as `push` — project name, description, dates, assumptions.

#### Step 10: Tab colors

```
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Schedule', red: 84, green: 130, blue: 53)
mcp__excel-mcp__worksheet_style(action: 'set-tab-color', session_id: '<id>', sheet_name: 'Project Info', red: 68, green: 114, blue: 196)
```

#### Step 11: Finalize

```
mcp__excel-mcp__calculation_mode(action: 'calculate', session_id: '<id>', scope: 'Workbook')
mcp__excel-mcp__calculation_mode(action: 'set-mode', session_id: '<id>', mode: 'Automatic')
```

Screenshot for verification:
```
mcp__excel-mcp__screenshot(action: 'capture-sheet', session_id: '<id>', sheet_name: 'Schedule', quality: 'Medium')
```

Present screenshot to user.

```
mcp__excel-mcp__window(action: 'clear-status-bar', session_id: '<id>')
mcp__excel-mcp__file(action: 'close', session_id: '<id>', save: true)
```

#### Step 12: Update metadata

Update `gantt-project.json`:
- Set `metadata.lastSyncedToExcel` to current ISO 8601 timestamp
- Set `metadata.lastModified` to current timestamp

Report: "Pushed [N] tasks to [path] (MS Project format). Open in Project via File → Open to import with dependencies and durations intact."

---

### `help`

| Command | Description |
|---------|-------------|
| `/gantt:excel push [path]` | Export gantt-project.json to formatted .xlsx |
| `/gantt:excel push-for-project [path]` | Export .xlsx formatted for MS Project import |
| `/gantt:excel pull [path]` | Import Excel into gantt-project.json |
| `/gantt:excel status` | Compare JSON vs Excel state |
| `/gantt:excel template [path]` | Create blank fillable template |
| `/gantt:excel help` | Show this help |

**Note:** All commands require the excel-mcp MCP server. The .xlsx file must be closed in Excel before operating.
