import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {HttpIdentity} from '../src/core/identity/http-identity.ts';

test('requesting password recovery accepts an empty 202 and uses the versioned identity transport',async()=>{
  let requestBody:unknown;
  let path:string|undefined,protocol:string|string[]|undefined;
  const server=createServer((request,response)=>{
    path=request.url;protocol=request.headers['x-ritmo-protocol'];
    const chunks:Buffer[]=[];
    request.on('data',(chunk:Buffer)=>chunks.push(chunk));
    request.on('end',()=>{requestBody=JSON.parse(Buffer.concat(chunks).toString());response.writeHead(202).end();});
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();assert.ok(address&&typeof address!=='string');
  try {
    const api=new HttpIdentity('http://127.0.0.1:'+address.port);
    await api.requestPasswordReset('person@example.test');
    assert.equal(path,'/api/v1/auth/password-reset/request');assert.equal(protocol,'m1.1');
    assert.deepEqual(requestBody,{email:'person@example.test'});
  } finally {server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

import {resetTokenFromLink} from '../src/core/identity/reset-link.ts';

test('a recovery link must use the configured HTTPS origin and keep its token only in the fragment',()=>{
  const token='a'.repeat(43),origin='https://api.example.test';
  assert.equal(resetTokenFromLink(origin+'/password-reset#token='+token,origin),token);
  for(const link of [
    'https://attacker.example/password-reset#token='+token,
    'http://api.example.test/password-reset#token='+token,
    origin+'/other#token='+token,
    origin+'/password-reset?token='+token,
    origin+'/password-reset?tracking=1#token='+token,
    origin+'/password-reset#token='+token+'&token='+token,
    'https://user@api.example.test/password-reset#token='+token,
    origin+'/password-reset#token=short',
  ]) assert.throws(()=>resetTokenFromLink(link,origin),/invalid_reset_link/);
});
