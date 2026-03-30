// ══════════════════════════════════════════════════════
//  PLANNER — Work calendar utilities
//  Provides work-hour aware date math when the advanced
//  time planner is enabled in CFG.planner.
// ══════════════════════════════════════════════════════

function plannerEnabled() { return !!(CFG.planner?.enabled); }

// Returns the effective work calendar for an assignee.
// Falls back to global CFG.planner settings if no override exists.
// holidays = union of global holidays + assignee-specific holidays.
function getWorkCalendar(assignee) {
  const p = CFG.planner || {};
  const base = {
    workDays:       Array.isArray(p.workDays)          ? p.workDays        : [1,2,3,4,5],
    workStart:      typeof p.workStart      === 'number'? p.workStart       : 9,
    workEnd:        typeof p.workEnd        === 'number'? p.workEnd         : 17,
    dailyWorkHours: typeof p.dailyWorkHours === 'number'? p.dailyWorkHours  : 8,
    holidays:       Array.isArray(p.holidays)           ? p.holidays        : [],
  };
  if (assignee && p.assigneeOverrides?.[assignee]) {
    const ov = p.assigneeOverrides[assignee];
    const ovHolidays = Array.isArray(ov.holidays) ? ov.holidays : [];
    return {
      workDays:       Array.isArray(ov.workDays)          ? ov.workDays       : base.workDays,
      workStart:      typeof ov.workStart      === 'number'? ov.workStart      : base.workStart,
      workEnd:        typeof ov.workEnd        === 'number'? ov.workEnd        : base.workEnd,
      dailyWorkHours: typeof ov.dailyWorkHours === 'number'? ov.dailyWorkHours : base.dailyWorkHours,
      holidays:       [...new Set([...base.holidays, ...ovHolidays])],
    };
  }
  return base;
}

// date = Date object; workDays = [0..6]; holidays = ['YYYY-MM-DD', ...]
function isWorkDay(date, workDays, holidays) {
  if (!workDays.includes(date.getDay())) return false;
  if (!holidays || !holidays.length) return true;
  return !holidays.includes(_plannerFmtDate(date));
}

function toNextWorkDay(date, workDays, holidays) {
  const d = new Date(date);
  while (!isWorkDay(d, workDays, holidays)) d.setDate(d.getDate() + 1);
  return d;
}

function _plannerFmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Given startStr (YYYY-MM-DD), work hours (float), a calendar, and an optional
// startHour (hour within first day work begins, defaults to workStart),
// returns { end: 'YYYY-MM-DD', endHour: number, calendarDays: number }.
function workHoursToEnd(startStr, workHours, cal, startHour) {
  const { workDays, workStart, workEnd, dailyWorkHours, holidays } = cal;
  const sHour = (typeof startHour === 'number' && startHour >= workStart && startHour < workEnd)
    ? startHour : workStart;
  let d = toNextWorkDay(new Date(startStr + 'T00:00:00'), workDays, holidays);
  const startD = new Date(d);
  let rem = workHours;
  let curHour = sHour;
  const MAX_ITER = 500;
  let iter = 0;
  while (rem > 0.001 && iter++ < MAX_ITER) {
    const availH = workEnd - curHour;
    if (rem <= availH) {
      return {
        end: _plannerFmtDate(d),
        endHour: curHour + rem,
        calendarDays: Math.round((d - startD) / 86400000),
      };
    }
    rem -= availH;
    const next = new Date(d); next.setDate(next.getDate() + 1);
    d = toNextWorkDay(next, workDays, holidays);
    curHour = workStart;
  }
  return { end: _plannerFmtDate(d), endHour: workStart, calendarDays: Math.round((d - startD) / 86400000) };
}

// Given the end date/endHour of a blocking task, returns where the next task starts.
// If blocker ends mid-day (endHour < workEnd), blocked task starts same day at endHour.
// Otherwise, advance to the next available work day (respecting holidays).
function blockerToNextStart(endStr, endHour, cal) {
  const { workDays, workStart, workEnd, holidays } = cal;
  if (typeof endHour === 'number' && endHour < workEnd) {
    return { start: endStr, startHour: endHour };
  }
  const next = new Date(endStr + 'T00:00:00'); next.setDate(next.getDate() + 1);
  const d = toNextWorkDay(next, workDays, holidays);
  return { start: _plannerFmtDate(d), startHour: workStart };
}

// x-offset (pixels) within a day column for a given startHour.
function plannerDayOffset(startHour, cal, dayW) {
  const { workStart, dailyWorkHours } = cal;
  const wh = dailyWorkHours > 0 ? dailyWorkHours : 8;
  return Math.max(0, (startHour - workStart) / wh) * dayW;
}

// Breaks a task into work segments: one per calendar day actually worked.
// Returns [{x, w, takenH}] in canvas pixels, relative to rangeMinDate.
// Skips non-working days and holidays automatically.
// startStr: 'YYYY-MM-DD', startHour: number|undefined, workHours: float,
// cal: getWorkCalendar() result, rangeMinDate: Date, dayW: pixels/day.
function getWorkSegments(startStr, startHour, workHours, cal, rangeMinDate, dayW) {
  const { workDays, workStart, workEnd, dailyWorkHours, holidays } = cal;
  const wh = dailyWorkHours > 0 ? dailyWorkHours : 8;
  const hourW = dayW / wh;
  const sHour = (typeof startHour === 'number' && startHour >= workStart && startHour < workEnd)
    ? startHour : workStart;
  let d = toNextWorkDay(new Date(startStr + 'T00:00:00'), workDays, holidays);
  let curHour = sHour;
  let rem = workHours;
  const segs = [];
  const MAX_ITER = 500;
  let iter = 0;
  while (rem > 0.001 && iter++ < MAX_ITER) {
    const availH = workEnd - curHour;
    const takenH = Math.min(rem, availH);
    const dayIdx = Math.round((d - rangeMinDate) / 86400000);
    const xOff = (curHour - workStart) * hourW;
    segs.push({ x: dayIdx * dayW + xOff, w: Math.max(takenH * hourW, 4), takenH });
    rem -= takenH;
    if (rem > 0.001) {
      const next = new Date(d); next.setDate(next.getDate() + 1);
      d = toNextWorkDay(next, workDays, holidays);
      curHour = workStart;
    }
  }
  return segs;
}
