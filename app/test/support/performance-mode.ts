import assert from 'node:assert/strict';
import {assembleToggleProfiles,attributeToggleProfiles} from './toggle-profile.ts';
export function requirePerformanceMode(value:unknown):'lightweight'|'detailed' {
 assert.ok(value==='lightweight'||value==='detailed','explicit_performance_mode_required');return value;
}
export function validateObservationMode(mode:'lightweight'|'detailed',frames:readonly unknown[],marks:readonly unknown[],chunks:readonly unknown[]) {
 assert.ok(marks.length>0,'performance_marks_missing');
 for(const value of marks)assert.ok(value&&typeof value==='object'&&'mode' in value&&value.mode===mode,'performance_mode_mismatch');
 if(mode==='detailed')return attributeToggleProfiles(frames,marks,assembleToggleProfiles(chunks));
 assert.equal(chunks.length,0,'lightweight_contains_detailed_profiles');return [];
}
