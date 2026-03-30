// ══════════════════════════════════════════════════════
//  DEFAULT CONFIGURATION
//  Single source of truth for factory statuses, types
//  and appearance settings. Edit here to change the
//  defaults that ship with new / reset sessions.
// ══════════════════════════════════════════════════════
// App version — bump here on every release
const APP_VERSION = '1.5.0';

const CFG_DEFAULTS = {
  statuses: [
    { id: 'todo',    name: 'Pendiente',    color: '#555555' },
    { id: 'doing',   name: 'En curso',     color: '#60a5fa' },
    { id: 'review',  name: 'En revisión',  color: '#fbbf24' },
    { id: 'done',    name: 'Hecho',        color: '#6ee7b7' },
    { id: 'blocked', name: 'Bloqueado',    color: '#f87171' },
  ],
  types: [
    { id: 'task',      name: 'Task',      isGroup: false, shape: 'circle',  color: '#888888', borderColor: '#888888' },
    { id: 'project',   name: 'Project',   isGroup: true,  shape: 'rect',    color: '#a78bfa', borderColor: '#a78bfa' },
    { id: 'milestone', name: 'Milestone', isGroup: false, shape: 'diamond', color: '#fbbf24', borderColor: '#fbbf24' },
    { id: 'idea',      name: 'Idea',      isGroup: false, shape: 'circle',  color: '#60a5fa', borderColor: '#60a5fa' },
  ],
  theme: 'dark',
  themeTokens: { bg: '#080808', surface: '#111111', accent: '#6ee7b7', text: '#e0e0e0' },
  currency: '€',
  durationUnit: 'd',
  graphAnimations: true,
  breakdownInheritance: true,
  breakdownInheritTypes: [],   // [] = all ancestor types; non-empty = only listed types
  planner: {
    enabled:          false,
    dailyWorkHours:   8,
    workStart:        9,
    workEnd:          17,
    workDays:         [1,2,3,4,5], // 0=Sun 1=Mon ... 6=Sat
    holidays:         [],          // ['YYYY-MM-DD', ...] global non-working dates
    assigneeOverrides: {},         // { 'Name': { workDays, workStart, workEnd, dailyWorkHours, holidays } }
  },
};
