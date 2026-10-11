export const habitIcons={meditation:'🧘',reading:'📖',water:'💧',running:'🏃',noPhone:'📵',strength:'💪',gaming:'🎮',movies:'🎬',walking:'🚶',stretching:'🤸',music:'🎸',writing:'✍️',plant:'🌱',target:'🎯'} as const;
export type HabitIcon=keyof typeof habitIcons;
export const habitPickerIcons:readonly HabitIcon[]=['meditation','reading','water','running','noPhone','plant','strength','gaming','movies','writing'];
export function habitGlyph(key:string|null|undefined) {return key&&key in habitIcons?habitIcons[key as HabitIcon]:'✓';}
