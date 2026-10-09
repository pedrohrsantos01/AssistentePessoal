import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {titleKey} from '../src/features/habits/domain/title.ts';
const fixtures=JSON.parse(readFileSync(new URL('../../contracts/primeiro-marco/domain-fixtures.json',import.meta.url),'utf8')) as {titleKey:{input:string;expected:string}[]};
test('title uniqueness uses the shared canonical fixtures and Unicode full folding',()=>{
 for(const {input,expected} of fixtures.titleKey) assert.equal(titleKey(input),expected);
 for(const [input,expected] of [['ΟΣ','οσ'],['ς','σ'],['İ','i\u0307'],['ı','ı'],['I','i'],[' A\u0085\u00a0B ','a b'],['\ufeffA','\ufeffa']]) assert.equal(titleKey(input!),expected);
});
