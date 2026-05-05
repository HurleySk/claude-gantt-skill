#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const ENGINE = path.join(__dirname, 'gantt-engine.js');
let passed = 0;
let failed = 0;

function run(input) {
  const result = execSync(`node "${ENGINE}"`, {
    input: JSON.stringify(input),
    encoding: 'utf-8',
  });
  return JSON.parse(result);
}

function assert(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    console.log(`    expected: ${e}`);
    console.log(`    actual:   ${a}`);
    failed++;
  }
}

// ============================================================
// Holiday Tests
// ============================================================
console.log('\n=== Holiday Resolution ===');

const h2026 = run({ command: 'holidays', startDate: '2026-01-01', endDate: '2026-12-31' });
assert('holidays command succeeds', h2026.ok, true);
assert('11 holidays in 2026', h2026.result.holidays.length, 11);

const dates2026 = h2026.result.holidays.map(h => h.date);
assert('New Year 2026 (Thu)', dates2026.includes('2026-01-01'), true);
assert('MLK Day 2026 (3rd Mon Jan)', dates2026.includes('2026-01-19'), true);
assert('Presidents Day 2026 (3rd Mon Feb)', dates2026.includes('2026-02-16'), true);
assert('Memorial Day 2026 (last Mon May)', dates2026.includes('2026-05-25'), true);
assert('Juneteenth 2026 (Fri)', dates2026.includes('2026-06-19'), true);
assert('Independence Day 2026 (Sat->Fri Jul 3)', dates2026.includes('2026-07-03'), true);
assert('Labor Day 2026 (1st Mon Sep)', dates2026.includes('2026-09-07'), true);
assert('Columbus Day 2026 (2nd Mon Oct)', dates2026.includes('2026-10-12'), true);
assert('Veterans Day 2026 (Wed)', dates2026.includes('2026-11-11'), true);
assert('Thanksgiving 2026 (4th Thu Nov)', dates2026.includes('2026-11-26'), true);
assert('Christmas 2026 (Fri)', dates2026.includes('2026-12-25'), true);

// Edge case: July 4 on Sunday -> observed Monday
const h2027 = run({ command: 'holidays', startDate: '2027-07-01', endDate: '2027-07-31' });
const jul4_2027 = h2027.result.holidays.find(h => h.name === 'Independence Day');
assert('Independence Day 2027 (Sun->Mon Jul 5)', jul4_2027.date, '2027-07-05');

// ============================================================
// Sequencing Tests
// ============================================================
console.log('\n=== Task Sequencing ===');

const simpleProject = {
  project: {
    name: 'Test',
    startDate: '2026-06-01',
    deadline: '2026-07-31',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    holidays: 'us-federal',
    assumptions: [],
  },
  tasks: [
    { id: 'T1', name: 'Task 1', phase: 'A', duration: '5d', start: null, finish: null, milestone: false, dependencies: [], notes: '', status: 'not_started' },
    { id: 'T2', name: 'Task 2', phase: 'A', duration: '3d', start: null, finish: null, milestone: false, dependencies: [{ id: 'T1', type: 'FS', lag: '0d' }], notes: '', status: 'not_started' },
    { id: 'M1', name: 'Milestone', phase: 'A', duration: '0d', start: null, finish: null, milestone: true, dependencies: [{ id: 'T2', type: 'FS', lag: '0d' }], notes: '', status: 'not_started' },
  ],
};

const seq = run({ command: 'sequence', project: JSON.parse(JSON.stringify(simpleProject)) });
assert('sequence succeeds', seq.ok, true);
// T1: Mon Jun 1 -> Fri Jun 5 (5 working days, start counts as day 1)
assert('T1 start', seq.result.project.tasks[0].start, '2026-06-01');
assert('T1 finish', seq.result.project.tasks[0].finish, '2026-06-05');
// T2: Mon Jun 8 -> Wed Jun 10 (next working day after T1 finish, 3 days)
assert('T2 start', seq.result.project.tasks[1].start, '2026-06-08');
assert('T2 finish', seq.result.project.tasks[1].finish, '2026-06-10');
// M1: Thu Jun 11 (milestone, 0d, next working day after T2 finish)
assert('M1 start', seq.result.project.tasks[2].start, '2026-06-11');
assert('M1 finish', seq.result.project.tasks[2].finish, '2026-06-11');

// ============================================================
// Holiday-Aware Sequencing
// ============================================================
console.log('\n=== Holiday-Aware Sequencing ===');

const holidayProject = {
  project: {
    name: 'Holiday Test',
    startDate: '2026-06-29',
    deadline: '2026-08-31',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    holidays: 'us-federal',
    assumptions: [],
  },
  tasks: [
    { id: 'T1', name: 'Task spanning July 4', phase: 'A', duration: '5d', start: null, finish: null, milestone: false, dependencies: [], notes: '', status: 'not_started' },
  ],
};

const hseq = run({ command: 'sequence', project: JSON.parse(JSON.stringify(holidayProject)) });
assert('holiday sequence succeeds', hseq.ok, true);
// Jun 29 (Mon) start. 5 working days: Jun 29, 30, Jul 1, 2, Jul 6
// (skip Jul 3 observed Independence Day + Jul 4 Sat + Jul 5 Sun)
assert('T1 start (holiday)', hseq.result.project.tasks[0].start, '2026-06-29');
assert('T1 finish (holiday)', hseq.result.project.tasks[0].finish, '2026-07-06');

// ============================================================
// Critical Path Tests
// ============================================================
console.log('\n=== Critical Path ===');

const cpProject = {
  project: {
    name: 'CP Test',
    startDate: '2026-06-01',
    deadline: '2026-07-31',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    holidays: 'us-federal',
    assumptions: [],
  },
  tasks: [
    { id: 'T1', name: 'Long path start', phase: 'A', duration: '10d', start: null, finish: null, milestone: false, dependencies: [], notes: '', status: 'not_started' },
    { id: 'T2', name: 'Short parallel', phase: 'A', duration: '3d', start: null, finish: null, milestone: false, dependencies: [], notes: '', status: 'not_started' },
    { id: 'T3', name: 'After long', phase: 'A', duration: '5d', start: null, finish: null, milestone: false, dependencies: [{ id: 'T1', type: 'FS', lag: '0d' }], notes: '', status: 'not_started' },
    { id: 'M1', name: 'End', phase: 'A', duration: '0d', start: null, finish: null, milestone: true, dependencies: [{ id: 'T2', type: 'FS', lag: '0d' }, { id: 'T3', type: 'FS', lag: '0d' }], notes: '', status: 'not_started' },
  ],
};

const cp = run({ command: 'critical-path', project: JSON.parse(JSON.stringify(cpProject)) });
assert('critical-path succeeds', cp.ok, true);
const t1task = cp.result.tasks.find(t => t.id === 'T1');
assert('T1 is critical', t1task.critical, true);
const t2task = cp.result.tasks.find(t => t.id === 'T2');
assert('T2 is not critical', t2task.critical, false);
assert('T2 has positive float', t2task.float > 0, true);
const t3task = cp.result.tasks.find(t => t.id === 'T3');
assert('T3 is critical', t3task.critical, true);

// ============================================================
// Circular Dependency Detection
// ============================================================
console.log('\n=== Circular Dependency ===');

const circularProject = {
  project: { name: 'Circular', startDate: '2026-06-01', deadline: '2026-07-31', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], holidays: 'us-federal', assumptions: [] },
  tasks: [
    { id: 'T1', name: 'A', phase: 'A', duration: '5d', start: null, finish: null, milestone: false, dependencies: [{ id: 'T2', type: 'FS', lag: '0d' }], notes: '', status: 'not_started' },
    { id: 'T2', name: 'B', phase: 'A', duration: '5d', start: null, finish: null, milestone: false, dependencies: [{ id: 'T1', type: 'FS', lag: '0d' }], notes: '', status: 'not_started' },
  ],
};

const circ = run({ command: 'sequence', project: JSON.parse(JSON.stringify(circularProject)) });
assert('circular dependency detected', circ.ok, false);
assert('error mentions circular', circ.error.includes('Circular'), true);

// ============================================================
// Feasibility Tests
// ============================================================
console.log('\n=== Feasibility ===');

const feasibleProject = JSON.parse(JSON.stringify(simpleProject));
const feas = run({ command: 'feasibility', project: feasibleProject });
assert('feasibility succeeds', feas.ok, true);
assert('project is feasible', feas.result.feasible, true);
assert('has positive float', feas.result.floatDays > 0, true);

const tightProject = JSON.parse(JSON.stringify(simpleProject));
tightProject.project.deadline = '2026-06-05';
const tight = run({ command: 'feasibility', project: tightProject });
assert('tight feasibility succeeds', tight.ok, true);
assert('tight project is not feasible', tight.result.feasible, false);
assert('has negative float', tight.result.floatDays < 0, true);

// ============================================================
// Add Task
// ============================================================
console.log('\n=== Add Task ===');

const addProject = JSON.parse(JSON.stringify(simpleProject));
const added = run({ command: 'add-task', project: addProject, task: { id: 'T3', name: 'New task', duration: '2d', dependencies: [{ id: 'T1', type: 'FS', lag: '0d' }] } });
assert('add-task succeeds', added.ok, true);
assert('new task has correct id', added.result.task.id, 'T3');

const dupAdd = run({ command: 'add-task', project: addProject, task: { id: 'T1', name: 'Dup', duration: '1d', dependencies: [] } });
assert('duplicate task rejected', dupAdd.ok, false);

const badDep = run({ command: 'add-task', project: addProject, task: { id: 'T4', name: 'Bad dep', duration: '1d', dependencies: [{ id: 'T99', type: 'FS', lag: '0d' }] } });
assert('unknown dependency rejected', badDep.ok, false);

// ============================================================
// Summary
// ============================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
