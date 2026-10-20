type Calendar={timezone:string;formatter:Intl.DateTimeFormat;boundaries:Map<number,number>};
let lastCalendar:Calendar|undefined;
function calendarIn(timezone:string):Calendar {
  if(lastCalendar?.timezone===timezone) return lastCalendar;
  const formatter=new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn',{
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  });
  return lastCalendar={timezone,formatter,boundaries:new Map()};
}

function civilAt(instant:number,formatter:Intl.DateTimeFormat):Date {
  const parts=formatter.formatToParts(new Date(instant));
  const value=(type:Intl.DateTimeFormatPartTypes)=>Number(parts.find(part=>part.type===type)!.value);
  const civil=new Date(0);
  civil.setUTCFullYear(value('year'),value('month')-1,value('day'));
  civil.setUTCHours(value('hour'),value('minute'),value('second'),0);
  return civil;
}

function boundaryAt(civil:Date,hour:number,calendar:Calendar):number {
  const wall=new Date(civil);wall.setUTCHours(hour,0,0,0);
  const target=wall.getTime(),cached=calendar.boundaries.get(target);
  if(cached!==undefined) return cached;
  const {formatter}=calendar,offsets=new Set<number>();
  // Only deterministic IANA resolutions, never an account's state or a cached "today".
  // Keep one timezone and at most two wall targets (normally today/next boundary).
  const remember=(instant:number)=>{
    if(calendar.boundaries.size>=2) calendar.boundaries.delete(calendar.boundaries.keys().next().value!);
    calendar.boundaries.set(target,instant);return instant;
  };
  // Sample both sides of IANA transitions; civil fields here are not UTC instants.
  for(let hours=-48;hours<=48;hours+=6) {
    const sample=target+hours*3600000;
    offsets.add(civilAt(sample,formatter).getTime()-sample);
  }
  const candidates=[...offsets].map(offset=>target-offset).sort((left,right)=>left-right);
  const first=candidates.find(instant=>civilAt(instant,formatter).getTime()===target);
  if(first!==undefined) return remember(first); // First occurrence when the local hour repeats.
  // A nonexistent hour starts at the transition, not at a shifted wall time.
  let before=candidates[0]!,after=candidates[candidates.length-1]!;
  if(civilAt(before,formatter).getTime()>=target||civilAt(after,formatter).getTime()<target) throw new RangeError('day_invalid');
  while(after-before>1) {
    const middle=Math.floor((before+after)/2);
    if(civilAt(middle,formatter).getTime()<target) before=middle;else after=middle;
  }
  return remember(after);
}

export function getDayKey(date:Date,timezone:string,dayStartHour:number):string {
  if(!Number.isFinite(date.getTime())||!Number.isInteger(dayStartHour)||dayStartHour<0||dayStartHour>23) throw new RangeError('day_invalid');
  const calendar=calendarIn(timezone),civil=civilAt(date.getTime(),calendar.formatter);
  if(date.getTime()<boundaryAt(civil,dayStartHour,calendar)) civil.setUTCDate(civil.getUTCDate()-1);
  return civil.toISOString().slice(0,10);
}

// Schedule exactly the next IANA logical-day boundary, including DST gaps/repeats.
export function nextLogicalDayAt(date:Date,timezone:string,dayStartHour:number):number {
  const current=new Date(getDayKey(date,timezone,dayStartHour)+'T00:00:00Z');
  current.setUTCDate(current.getUTCDate()+1);
  return boundaryAt(current,dayStartHour,calendarIn(timezone));
}
