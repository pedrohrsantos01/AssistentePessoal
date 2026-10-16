import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReaderHierarchy} from './support/reader-hierarchy.ts';

test('Android XML with a single-quoted JSON diagnostic preserves the original intention',()=>{
 const xml=`<hierarchy ime-visible="false"><node text='{&#10;"intention":{"command":{"title":"Incerto leitor"}},"diagnosis":{"code":"id_content_conflict"}}' content-desc="" /></hierarchy>`;
 const tree=parseReaderHierarchy(xml);assert.equal(tree.meta['ime-visible'],'false');
 assert.deepEqual(JSON.parse(tree.nodes[0]!.text!),{intention:{command:{title:'Incerto leitor'}},diagnosis:{code:'id_content_conflict'}});
});

test('mixed XML delimiters and escaped literal quotes remain distinct',()=>{
 const tree=parseReaderHierarchy(`<hierarchy><node text="D&apos;água &amp; &quot;leitura&quot;" content-desc='A &lt; B' bounds="[1,2][3,4]" /></hierarchy>`);
 assert.equal(tree.nodes[0]!.text,`D'água & "leitura"`);assert.equal(tree.nodes[0]!['content-desc'],'A < B');assert.equal(tree.nodes[0]!.bounds,'[1,2][3,4]');
});

test('all own interactive windows retain focus evidence without contaminating the top-window driver',()=>{
 const tree=parseReaderHierarchy(`<hierarchy focused-window-id="4"><window id="4" topmost="true" accessibility-focused="true"><node window-id="4" topmost-window="true" text="Diálogo" accessibility-focused="true" /></window><window id="3" topmost="false" accessibility-focused="false"><node window-id="3" topmost-window="false" text="Fundo" accessibility-focused="true" /></window></hierarchy>`);
 assert.equal(tree.nodes.length,1);assert.equal(tree.allNodes.length,2);assert.equal(tree.windows.length,2);
 // A stale/background focused node must remain observable to a confinement assertion.
 assert.equal(tree.allNodes.filter(n=>n['accessibility-focused']==='true').length,2);
 assert.equal(tree.meta['focused-window-id'],'4');assert.equal(tree.windows[1]!.id,'3');
});
