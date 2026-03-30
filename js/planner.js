// ══════════════════════════════════════════════════════
//  PLANNER — Work calendar utilities
//  Provides work-hour aware date math when the advanced
//  time planner is enabled in CFG.planner.
// ══════════════════════════════════════════════════════

function plannerEnabled() { return !!(CFG.planner?.enabled); }

// Returns the effective work calendar for an assignee.
// Falls back to global CFG.planner settings if no override exists.
function getWorkCalendar(assignee) {
  const p = CFG.planner || {};
  const base = {
    workDays:       Array.isArray(p.workDays)          ? p.workDays        : [1,2,3,4,5],
    workStart:      typeof p.workStart      === 'number'? p.workStart       : 9,
    workEnd:        typeof p.workEnd        === 'number'? p.workEnd         : 17,
    dailyWorkHours: typeof p.dailyWorkHours === 'number'? p.dailyWorkHours  : 8,
  };
  if (assignee && p.assigneeOverrides?.[assignee]) {
    const ov = p.assigneeOverrides[assignee];
    return {
      workDays:       Array.isArray(ov.workDays)          ? ov.workDays       : base.workDays,
      workStart:      typeof ov.workStart      === 'number'? ov.workStart      : base.workStart,
      workEnd:        typeof ov.workEnd        === 'number'? ov.workEnd        : base.workEnd,
      dailyWorkHours: typeof ov.dailyWorkHours === 'number'? ov.dailyWorkHours : base.dailyWorkHours,
    };
  }
  return base;
}

function isWorkDay(date, workDays) { return workDays.includes(date.getDay()); }

function toNextWorkDay(date, workDays) {
  const d = new Date(date);
  while (!isWorkDay(d, workDays)) d.setDate(d.getDate() + 1);
  return d;
}

function _plannerFmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Given startStr (YYYY-MM-DD), work hours (float) and a calendar,
// returns { end: 'YYYY-MM-DD', endHour: number, calendarDays: number }.
// endHour is the fractional hour within the day the task ends (e.g. 13 = 1pm).
function workHoursToEnd(startStr, workHours, cal) {
  const { workDays, workStart, dailyWorkHours } = cal;
  const wh = dailyWorkHours > 0 ? dailyWorkHours : 8;
  let d = toNextWorkDay(new Date(startStr + 'T00:00:00'), workDays);
  const startD = new Date(d);
  let rem = workHours;
  while (rem > 0) {
    if (rem <= wh) {
      return {
        end: _plannerFmtDate(d),
        endHour: workStart + rem,
        calendarDays: Math.round((d - startD) / 86400000),
      };
    }
    rem -= wh;
    d.setDate(d.getDate() + 1);
    while (!isWorkDay(d, workDays)) d.setDate(d.getDate() + 1);
  }
  return { end: _plannerFmtDate(d), endHour: workStart, calendarDays: Math.round((d - startD) / 86400000) };
}

// Given the end date/endHour of a blocking task, returns where the next task starts.
// If blocker ends mid-day (endHour < workEnd), blocked task starts same day at endHour.
// Otherwise, next working day at workStart.
function blockerToNextStart(endStr, endHour, cal) {
  const { workDays, workStart, workEnd } = cal;
  if (typeof endHour === 'number' && endHour < workEnd) {
    return { start: endStr, startHour: endHour };
  }
  const d = new Date(endStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  while (!isWorkDay(d, workDays)) d.setDate(d.getDate() + 1);
  return { start: _plannerFmtDate(d), startHour: workStart };
}

// x-offset (pixels) within a day column for a given startHour, with respect to the work calendar.
// Used by Gantt bar positioning.
function plannerDayOffset(startHour, cal, dayW) {
  const { workStart, dailyWorkHours } = cal;
  const wh = dailyWorkHours > 0 ? dailyWorkHours : 8;
  const offset = (startHour - workStart) / wh;
  return Math.max(0, offset) * dayW;
}
