export const habitIcons={meditation:'🧘',reading:'📖',water:'💧',running:'🏃',walking:'🚶',stretching:'🤸',music:'🎸',writing:'✍️',plant:'🌱',target:'🎯'} as const;
export type HabitIcon=keyof typeof habitIcons;
export function habitGlyph(key:string|null|undefined) {return key&&key in habitIcons?habitIcons[key as HabitIcon]:'✓';}
