import {generateKeyPairSync, randomUUID, sign, createHash} from 'node:crypto';
import {readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import {basename, join} from 'node:path';
import {Client, credentials, Metadata, status, type MethodDefinition} from '@grpc/grpc-js';
import {loadSync} from '@grpc/proto-loader';

const touchPath = '/android.emulation.control.EmulatorController/sendTouch';
type Point = readonly [number, number];
type TouchEvent = {touches: {x: number; y: number; identifier: number; pressure: number}[]};
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// Test-only bridge. The launcher proves ownership and loopback binding before passing discovery.
// Private key and short-lived JWTs stay in memory; only the public JWK is written.
export async function openEmulatorTouch() {
  const discovery = process.env.RITMO_EMULATOR_DISCOVERY;
  const port = Number(process.env.RITMO_EMULATOR_GRPC_PORT);
  const sdk = process.env.ANDROID_HOME;
  if (!discovery || !/^pid_[0-9]+(?:_info)?[.]ini$/.test(basename(discovery)) || !sdk || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('owned_emulator_discovery_required');
  const ini = new Map<string, string>();
  for (const line of readFileSync(discovery, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1]!.trim();
      if (ini.has(key)) throw new Error('ambiguous_emulator_discovery');
      ini.set(key, match[2]!.trim());
    }
  }
  const jwks = ini.get('grpc.jwks'), active = ini.get('grpc.jwk_active');
  if (Number(ini.get('grpc.port')) !== port || !jwks || !active) throw new Error('authenticated_emulator_endpoint_required');
  const proto = join(sdk, 'emulator/lib/emulator_controller.proto');
  const definition = loadSync(proto, {keepCase: true})['android.emulation.control.EmulatorController'];
  if (!definition || !('sendTouch' in definition)) throw new Error('sdk_touch_service_missing');
  const method = definition.sendTouch as MethodDefinition<TouchEvent, unknown>;
  if (method.path !== touchPath || method.requestStream || method.responseStream) throw new Error('sdk_touch_contract_changed');
  const client = new Client('127.0.0.1:' + port, credentials.createInsecure(), {'grpc.enable_retries': 0});
  const {privateKey, publicKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
  const kid = randomUUID(), keyFile = join(jwks, 'ritmo-test-' + kid + '.jwk');
  let registered = false, contact: readonly Point[] = [[0, 0]];
  const metadata = (audience=touchPath,issuer='ritmo-reader-test') => {
    const iat = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({alg: 'ES256', kid})).toString('base64url');
    const claims = Buffer.from(JSON.stringify({iss: issuer, aud: [audience], iat, exp: iat + 60})).toString('base64url');
    const payload = header + '.' + claims;
    const signature = sign('sha256', Buffer.from(payload), {key: privateKey, dsaEncoding: 'ieee-p1363'}).toString('base64url');
    const value = new Metadata();
    value.set('authorization', 'Bearer ' + payload + '.' + signature);
    return value;
  };
  const call = (point: Point, pressure: number, auth = metadata()) => callMany([point], pressure, auth);
  const callMany = (points: readonly Point[], pressure: number, auth = metadata()) => new Promise<void>((resolve, reject) => {
    if (!points.length || !points.every(point => point.every(value => Number.isInteger(value) && value >= 0))) {reject(new Error('invalid_physical_coordinate')); return;}
    client.makeUnaryRequest(method.path, method.requestSerialize, method.responseDeserialize,
      {touches: points.map((point,identifier)=>({x:point[0],y:point[1],identifier,pressure}))}, auth, {deadline: Date.now() + 3000}, error => {
        // Do not expose JWTs, transport metadata or server-provided diagnostic strings.
        if (error) reject(new Error('emulator_touch_rpc_' + error.code)); else resolve();
      });
  });
  const close = async () => {
    try {if (registered) await callMany(contact, 0);} finally {
      client.close();
      unlinkSync(keyFile);
      registered = false;
    }
  };
  try {
    writeFileSync(keyFile, JSON.stringify({keys: [{...publicKey.export({format: 'jwk'}), kid, use: 'sig', alg: 'ES256'}]}), {flag: 'wx'});
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {if (readFileSync(active, 'utf8').includes(kid)) {registered = true; break;}} catch { /* SDK creates the active-key file asynchronously. */ }
      await pause(100);
    }
    if (!registered) throw new Error('emulator_public_key_not_registered');
    // Pressure zero releases a contact. Refuse endpoints accepting unauthenticated input.
    let unauthenticatedCode = 0;
    try {await call([0, 0], 0, new Metadata()); throw new Error('emulator_endpoint_accepted_unauthenticated_input');}
    catch (error) {
      const code = error instanceof Error ? Number(error.message.match(/^emulator_touch_rpc_([0-9]+)$/)?.[1]) : NaN;
      if (code !== status.UNAUTHENTICATED) throw error;
      unauthenticatedCode = code;
    }
    const denied = async (auth: Metadata) => {
      try {await call([0, 0], 0, auth); throw new Error('emulator_endpoint_accepted_out_of_scope_token');}
      catch (error) {
        const code=error instanceof Error?Number(error.message.match(/^emulator_touch_rpc_([0-9]+)$/)?.[1]):NaN;
        if (![status.UNAUTHENTICATED,status.PERMISSION_DENIED,status.INVALID_ARGUMENT].includes(code)) throw error;
        return code;
      }
    };
    const wrongAudienceCode=await denied(metadata('/not-authorized'));
    const wrongIssuerCode=await denied(metadata(touchPath,'not-authorized'));
    // The identical payload must succeed with authentication, distinguishing missing auth from invalid input.
    await call([0, 0], 0);
    return {
      unauthenticatedCode,wrongAudienceCode,wrongIssuerCode,
      protoSha256: createHash('sha256').update(readFileSync(proto)).digest('hex'),
      down: async (point: Point) => {contact = [point]; await callMany(contact, 1024);},
      move: async (point: Point) => {contact = [point]; await callMany(contact, 1024);},
      up: () => callMany(contact, 0),
      scroll: async (from: Point,to: Point) => {
        // Two simultaneous contacts are TalkBack's physical scrolling gesture.
        for(let frame=0;frame<=6;frame++){
          const x=Math.round(from[0]+(to[0]-from[0])*frame/6),y=Math.round(from[1]+(to[1]-from[1])*frame/6);
          contact=[[x,y],[x+80,y]];await callMany(contact,1024);await pause(35);
        }
        await callMany(contact,0);await pause(500);
      },
      close,
    };
  } catch (error) {
    client.close();
    try {unlinkSync(keyFile);} catch { /* The file may not have been created. */ }
    throw error;
  }
}
