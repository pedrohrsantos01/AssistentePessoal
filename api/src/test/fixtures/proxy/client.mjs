import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';

// A finite real client, with standard certificate/hostname validation.
const options = JSON.parse(process.argv[2]);
const secure = options.scheme !== 'http';
const transport = secure ? https : http;
const request = transport.request({
  hostname: options.hostname ?? 'api.example.test',
  port: secure ? 443 : (options.port ?? 80),
  path: options.path ?? '/api/v1/auth/login',
  method: options.get ? 'GET' : 'POST',
  ca: options.trust === false ? undefined : readFileSync('/fixture/ritmo.crt'),
  minVersion: options.minVersion ?? 'TLSv1.2',
  maxVersion: options.maxVersion,
  headers: {
    'X-Ritmo-Protocol': 'm1.1', 'X-App-Version': '0.1.0',
    'Content-Type': 'application/json',
    ...options.headers,
  },
}, response => {
  let body = '';
  response.setEncoding('utf8');
  response.on('data', chunk => { body += chunk; });
  response.on('end', () => {
    process.stdout.write(JSON.stringify({ status: response.statusCode, headers: response.headers, body }));
  });
});
const deadline = setTimeout(() => request.destroy(new Error('fixture_deadline')), 12000);
request.on('close', () => clearTimeout(deadline));
request.on('error', error => process.stdout.write(JSON.stringify({ error: error.code ?? error.message })));
request.end(options.get ? undefined : JSON.stringify({
  email: 'unknown@example.test', password: 'fixture-password',
  deviceId: '018fbe80-1234-7000-8000-000000000001',
}));
