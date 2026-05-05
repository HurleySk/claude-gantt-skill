#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const HOLIDAYS_PATH = path.join(__dirname, 'holidays.json');
const holidayPresets = JSON.parse(fs.readFileSync(HOLIDAYS_PATH, 'utf-8'));

// --- Date Utilities ---

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// --- Holiday Resolution ---

function resolveHoliday(rule, year) {
  if (rule.day !== undefined) {
    let d = new Date(year, rule.month - 1, rule.day);
    if (rule.observed === 'nearest-weekday') {
      const dow = d.getDay();
      if (dow === 6) d = addDays(d, -1);
      if (dow === 0) d = addDays(d, 1);
    }
    return { name: rule.name, date: formatDate(d) };
  }
  if (rule.occurrence === -1) {
    const lastDay = new Date(year, rule.month, 0);
    let d = new Date(lastDay);
    while (d.getDay() !== rule.weekday) d = addDays(d, -1);
    return { name: rule.name, date: formatDate(d) };
  }
  const firstOfMonth = new Date(year, rule.month - 1, 1);
  let d = new Date(firstOfMonth);
  while (d.getDay() !== rule.weekday) d = addDays(d, 1);
  d = addDays(d, (rule.occurrence - 1) * 7);
  return { name: rule.name, date: formatDate(d) };
}

function getHolidays(preset, startDate, endDate) {
  const rules = holidayPresets[preset];
  if (!rules) return { ok: false, error: `Unknown holiday preset: ${preset}` };
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const holidays = [];
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    for (const rule of rules) {
      const h = resolveHoliday(rule, y);
      const hd = parseDate(h.date);
      if (hd >= start && hd <= end) holidays.push(h);
    }
  }
  holidays.sort((a, b) => a.date.localeCompare(b.date));
  return holidays;
}

function getHolidaySet(preset, startDate, endDate) {
  const holidays = getHolidays(preset, startDate, endDate);
  if (holidays.error) return holidays;
  return new Set(holidays.map(h => h.date));
}

// --- Working Day Math ---

function isWorkingDay(date, workingDays, holidaySet) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = dayNames[date.getDay()];
  if (!workingDays.includes(dayName)) return false;
  if (holidaySet.has(formatDate(date))) return false;
  return true;
}

function addWorkingDays(start, count, workingDays, holidaySet) {
  let current = new Date(start);
  let added = 0;
  while (added < count) {
    current = addDays(current, 1);
    if (isWorkingDay(current, workingDays, holidaySet)) added++;
  }
  return current;
}

function nextWorkingDay(date, workingDays, holidaySet) {
  let d = new Date(date);
  while (!isWorkingDay(d, workingDays, holidaySet)) d = addDays(d, 1);
  return d;
}

function prevWorkingDay(date, workingDays, holidaySet) {
  let d = new Date(date);
  while (!isWorkingDay(d, workingDays, holidaySet)) d = addDays(d, -1);
  return d;
}

function subtractWorkingDays(start, count, workingDays, holidaySet) {
  let current = new Date(start);
  let subtracted = 0;
  while (subtracted < count) {
    current = addDays(current, -1);
    if (isWorkingDay(current, workingDays, holidaySet)) subtracted++;
  }
  return current;
}

function countWorkingDays(from, to, workingDays, holidaySet) {
  let count = 0;
  let d = addDays(new Date(from), 1);
  const end = new Date(to);
  while (d <= end) {
    if (isWorkingDay(d, workingDays, holidaySet)) count++;
    d = addDays(d, 1);
  }
  return count;
}

// --- Duration Parsing ---

function parseDuration(s) {
  const match = s.match(/^(\d+)(d|w|h)$/);
  if (!match) throw new Error(`Invalid duration: ${s}`);
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'w') return val * 5;
  if (unit === 'h') return Math.ceil(val / 8);
  return val;
}

// --- Topological Sort ---

function topologicalSort(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map(tasks.map(t => [t.id, 0]));
  const adj = new Map(tasks.map(t => [t.id, []]));

  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (!taskMap.has(dep.id)) {
        throw new Error(`Task ${t.id} depends on unknown task ${dep.id}`);
      }
      adj.get(dep.id).push(t.id);
      inDegree.set(t.id, inDegree.get(t.id) + 1);
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);
    for (const next of adj.get(id)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  if (sorted.length !== tasks.length) {
    const remaining = tasks.filter(t => !sorted.includes(t.id)).map(t => t.id);
    throw new Error(`Circular dependency detected among: ${remaining.join(' -> ')}`);
  }

  return sorted.map(id => taskMap.get(id));
}

// --- Forward Pass ---

function forwardPass(tasks, projectStartDate, workingDays, holidayPresetName) {
  const startDate = parseDate(projectStartDate);
  const endEstimate = addDays(startDate, 365 * 3);
  const holidaySet = getHolidaySet(holidayPresetName, projectStartDate, formatDate(endEstimate));
  if (holidaySet.error) return { ok: false, error: holidaySet.error };

  const sorted = topologicalSort(tasks);
  const startMap = new Map();
  const finishMap = new Map();
  const warnings = [];

  for (const task of sorted) {
    const duration = parseDuration(task.duration);
    let earliestStart;
    let earliestFinish;

    if (task.dependencies.length === 0) {
      earliestStart = nextWorkingDay(startDate, workingDays, holidaySet);
      earliestFinish = duration === 0 ? earliestStart : addWorkingDays(earliestStart, duration - 1, workingDays, holidaySet);
    } else {
      let latestStartConstraint = new Date(startDate);
      let latestFinishConstraint = new Date(0);
      let hasFinishConstraint = false;

      for (const dep of task.dependencies) {
        const lag = dep.lag ? parseDuration(dep.lag) : 0;
        const type = dep.type || 'FS';

        if (type === 'FS') {
          // Successor can't start until predecessor finishes (+ lag)
          const predFinish = finishMap.get(dep.id);
          let c = addDays(predFinish, 1);
          if (lag > 0) c = addWorkingDays(predFinish, lag, workingDays, holidaySet);
          if (c > latestStartConstraint) latestStartConstraint = c;
        } else if (type === 'SS') {
          // Successor can't start until predecessor starts (+ lag)
          const predStart = startMap.get(dep.id);
          let c = new Date(predStart);
          if (lag > 0) c = addWorkingDays(predStart, lag, workingDays, holidaySet);
          if (c > latestStartConstraint) latestStartConstraint = c;
        } else if (type === 'FF') {
          // Successor can't finish until predecessor finishes (+ lag)
          const predFinish = finishMap.get(dep.id);
          let c = new Date(predFinish);
          if (lag > 0) c = addWorkingDays(predFinish, lag, workingDays, holidaySet);
          if (c > latestFinishConstraint) latestFinishConstraint = c;
          hasFinishConstraint = true;
        } else if (type === 'SF') {
          // Successor can't finish until predecessor starts (+ lag)
          const predStart = startMap.get(dep.id);
          let c = new Date(predStart);
          if (lag > 0) c = addWorkingDays(predStart, lag, workingDays, holidaySet);
          if (c > latestFinishConstraint) latestFinishConstraint = c;
          hasFinishConstraint = true;
        }
      }

      // Compute earliest start from start constraints
      earliestStart = nextWorkingDay(latestStartConstraint, workingDays, holidaySet);
      earliestFinish = duration === 0 ? earliestStart : addWorkingDays(earliestStart, duration - 1, workingDays, holidaySet);

      // If finish constraints push the finish later, back-calculate start
      if (hasFinishConstraint) {
        const requiredFinish = nextWorkingDay(latestFinishConstraint, workingDays, holidaySet);
        if (requiredFinish > earliestFinish) {
          earliestFinish = requiredFinish;
          earliestStart = duration === 0 ? earliestFinish : subtractWorkingDays(earliestFinish, duration - 1, workingDays, holidaySet);
        }
      }
    }

    task.start = formatDate(earliestStart);
    task.finish = formatDate(earliestFinish);
    startMap.set(task.id, earliestStart);
    finishMap.set(task.id, earliestFinish);
  }

  return { tasks: sorted, warnings };
}

// --- Backward Pass & Critical Path ---

function criticalPath(tasks, projectStartDate, workingDays, holidayPresetName) {
  const tasksCopy = tasks.map(t => ({ ...t, dependencies: [...t.dependencies] }));
  const fwd = forwardPass(tasksCopy, projectStartDate, workingDays, holidayPresetName);
  if (fwd.ok === false) return fwd;

  const scheduled = fwd.tasks;
  const startDate = parseDate(projectStartDate);
  const endEstimate = addDays(startDate, 365 * 3);
  const holidaySet = getHolidaySet(holidayPresetName, projectStartDate, formatDate(endEstimate));

  const projectFinish = scheduled.reduce((max, t) => {
    const f = parseDate(t.finish);
    return f > max ? f : max;
  }, new Date(0));

  const latestFinish = new Map();
  const latestStart = new Map();

  for (const t of scheduled) {
    latestFinish.set(t.id, new Date(projectFinish));
  }

  const adj = new Map(scheduled.map(t => [t.id, []]));
  for (const t of scheduled) {
    for (const dep of t.dependencies) {
      adj.get(dep.id).push(t.id);
    }
  }

  const taskMap = new Map(scheduled.map(t => [t.id, t]));
  const reversed = [...scheduled].reverse();
  for (const t of reversed) {
    const successors = adj.get(t.id);
    if (successors.length > 0) {
      let constrainedLf = new Date(8640000000000000);
      let constrainedLs = new Date(8640000000000000);

      for (const sId of successors) {
        const successor = taskMap.get(sId);
        const dep = successor.dependencies.find(d => d.id === t.id);
        const type = (dep && dep.type) || 'FS';
        const sLs = latestStart.get(sId);
        const sLf = latestFinish.get(sId);

        if (type === 'FS') {
          // Predecessor must finish before successor starts
          const c = prevWorkingDay(addDays(sLs, -1), workingDays, holidaySet);
          if (c < constrainedLf) constrainedLf = c;
        } else if (type === 'SS') {
          // Predecessor must start before/when successor starts
          const c = new Date(sLs);
          if (c < constrainedLs) constrainedLs = c;
        } else if (type === 'FF') {
          // Predecessor must finish before/when successor finishes
          const c = new Date(sLf);
          if (c < constrainedLf) constrainedLf = c;
        } else if (type === 'SF') {
          // Predecessor must start before/when successor finishes
          const c = new Date(sLf);
          if (c < constrainedLs) constrainedLs = c;
        }
      }

      if (constrainedLf < latestFinish.get(t.id)) {
        latestFinish.set(t.id, constrainedLf);
      }
      // For SS/SF constraints on start, back-calculate latest finish
      const dur = parseDuration(t.duration);
      if (constrainedLs < new Date(8640000000000000)) {
        const impliedLf = dur === 0 ? constrainedLs : addWorkingDays(constrainedLs, dur - 1, workingDays, holidaySet);
        if (impliedLf < latestFinish.get(t.id)) {
          latestFinish.set(t.id, impliedLf);
        }
      }
    }

    const lf = latestFinish.get(t.id);
    const duration = parseDuration(t.duration);
    let ls;
    if (duration === 0) {
      ls = lf;
    } else {
      ls = subtractWorkingDays(lf, duration - 1, workingDays, holidaySet);
    }
    latestStart.set(t.id, ls);
  }

  const criticalTasks = [];
  for (const t of scheduled) {
    const es = parseDate(t.start);
    const ls = latestStart.get(t.id);
    const floatDays = countWorkingDays(es, ls, workingDays, holidaySet);
    t.float = floatDays;
    t.critical = floatDays === 0;
    if (t.critical) criticalTasks.push(t);
  }

  return {
    projectFinish: formatDate(projectFinish),
    criticalTaskCount: criticalTasks.length,
    tasks: scheduled,
    criticalTasks,
  };
}

// --- Add Task ---

function addTask(project, taskDef) {
  const existing = project.tasks.find(t => t.id === taskDef.id);
  if (existing) return { ok: false, error: `Task ${taskDef.id} already exists` };
  for (const dep of (taskDef.dependencies || [])) {
    if (!project.tasks.find(t => t.id === dep.id)) {
      return { ok: false, error: `Dependency ${dep.id} does not exist` };
    }
  }
  const task = {
    id: taskDef.id,
    name: taskDef.name,
    phase: taskDef.phase || '',
    duration: taskDef.duration,
    start: null,
    finish: null,
    milestone: taskDef.milestone || false,
    dependencies: taskDef.dependencies || [],
    notes: taskDef.notes || '',
    status: 'not_started',
  };
  project.tasks.push(task);
  return { ok: true, result: { task } };
}

// --- Feasibility ---

function feasibility(project) {
  const cp = criticalPath(project.tasks, project.project.startDate, project.project.workingDays, project.project.holidays);
  if (cp.ok === false) return cp;

  const deadline = parseDate(project.project.deadline);
  const finish = parseDate(cp.projectFinish);

  const startDate = parseDate(project.project.startDate);
  const endEstimate = addDays(startDate, 365 * 3);
  const holidaySet = getHolidaySet(project.project.holidays, project.project.startDate, formatDate(endEstimate));

  let floatDays;
  if (finish <= deadline) {
    floatDays = countWorkingDays(finish, deadline, project.project.workingDays, holidaySet);
  } else {
    floatDays = -countWorkingDays(deadline, finish, project.project.workingDays, holidaySet);
  }

  return {
    feasible: finish <= deadline,
    projectFinish: cp.projectFinish,
    deadline: project.project.deadline,
    floatDays,
    criticalTaskCount: cp.criticalTaskCount,
    criticalTasks: cp.criticalTasks.map(t => ({ id: t.id, name: t.name, start: t.start, finish: t.finish })),
  };
}

// --- Command Dispatch ---

function dispatch(input) {
  switch (input.command) {
    case 'holidays': {
      const holidays = getHolidays(input.preset || 'us-federal', input.startDate, input.endDate);
      if (holidays.error) return { ok: false, error: holidays.error };
      return { ok: true, result: { holidays } };
    }
    case 'sequence': {
      const project = input.project;
      const fwd = forwardPass(project.tasks, project.project.startDate, project.project.workingDays, project.project.holidays);
      if (fwd.ok === false) return fwd;
      project.tasks = fwd.tasks;
      return { ok: true, result: { project }, warnings: fwd.warnings };
    }
    case 'critical-path': {
      const project = input.project;
      const cp = criticalPath(project.tasks, project.project.startDate, project.project.workingDays, project.project.holidays);
      if (cp.ok === false) return cp;
      return { ok: true, result: cp };
    }
    case 'feasibility': {
      const project = input.project;
      const f = feasibility(project);
      if (f.ok === false) return f;
      return { ok: true, result: f };
    }
    case 'add-task': {
      const project = input.project;
      return addTask(project, input.task);
    }
    default:
      return { ok: false, error: `Unknown command: ${input.command}. Valid: holidays, sequence, critical-path, feasibility, add-task` };
  }
}

function main() {
  let inputData = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => { inputData += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(inputData);
      const result = dispatch(input);
      console.log(JSON.stringify(result.ok !== undefined ? result : { ok: true, result }, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

main();
