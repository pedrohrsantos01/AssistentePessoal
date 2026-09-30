export const logicalDays=[
  {name:'midnight with start zero',at:'2026-01-01T00:00:00Z',timezone:'UTC',hour:0,expected:'2026-01-01'},
  {name:'previous year before start',at:'2026-01-01T03:59:59.999Z',timezone:'UTC',hour:4,expected:'2025-12-31'},
  {name:'leap day before March start',at:'2024-03-01T03:59:59.999Z',timezone:'UTC',hour:4,expected:'2024-02-29'},
  {name:'configured start at six',at:'2026-09-25T09:00:00Z',timezone:'America/Sao_Paulo',hour:6,expected:'2026-09-25'},
  {name:'Kolkata before start',at:'2026-09-24T22:29:59.999Z',timezone:'Asia/Kolkata',hour:4,expected:'2026-09-24'},
  {name:'Kolkata at start',at:'2026-09-24T22:30:00Z',timezone:'Asia/Kolkata',hour:4,expected:'2026-09-25'},
  {name:'Kathmandu before start',at:'2026-09-24T22:14:59.999Z',timezone:'Asia/Kathmandu',hour:4,expected:'2026-09-24'},
  {name:'Kathmandu at start',at:'2026-09-24T22:15:00Z',timezone:'Asia/Kathmandu',hour:4,expected:'2026-09-25'},
  {name:'New York start before 23 hour day',at:'2026-03-07T09:00:00Z',timezone:'America/New_York',hour:4,expected:'2026-03-07'},
  {name:'New York next start after 23 hours',at:'2026-03-08T08:00:00Z',timezone:'America/New_York',hour:4,expected:'2026-03-08'},
  {name:'New York start before 25 hour day',at:'2026-10-31T08:00:00Z',timezone:'America/New_York',hour:4,expected:'2026-10-31'},
  {name:'New York next start after 25 hours',at:'2026-11-01T09:00:00Z',timezone:'America/New_York',hour:4,expected:'2026-11-01'},
  {name:'New York repeated boundary first occurrence',at:'2026-11-01T05:00:00Z',timezone:'America/New_York',hour:1,expected:'2026-11-01'},
  {name:'New York repeated boundary second occurrence',at:'2026-11-01T06:00:00Z',timezone:'America/New_York',hour:1,expected:'2026-11-01'},
  {name:'New York nonexistent boundary',at:'2026-03-08T07:00:00Z',timezone:'America/New_York',hour:2,expected:'2026-03-08'},
  {name:'Lord Howe half hour gap',at:'2026-10-03T15:30:00Z',timezone:'Australia/Lord_Howe',hour:2,expected:'2026-10-04'},
  {name:'Chatham repeated hour after rollback',at:'2026-04-04T14:05:00Z',timezone:'Pacific/Chatham',hour:3,expected:'2026-04-05'}
] as const;
