"""Validate the design and its decision oracle, not a Java/browser implementation."""
from copy import deepcopy
from datetime import datetime
import json
from pathlib import Path
import re

from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate_spec

ROOT = Path(__file__).resolve().parent


def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))


API, LOCAL, POLICY = (read(name) for name in ['openapi.json', 'local.schema.json', 'policy.json'])
IDLE = POLICY['session']['idleSeconds']
ABSOLUTE = POLICY['session']['absoluteSeconds']
MAX_EPOCH = 9223372036854775807


def epoch(value):
    return isinstance(value, str) and re.fullmatch(r'0|[1-9][0-9]{0,18}', value) is not None and int(value) <= MAX_EPOCH


def remote_guard(value, check_owner=True):
    if value['origin'] != value['configuredOrigin'] or value['origin'] == 'null' or value['webHeader'] != '1' or value['contentType'].split(';')[0] != 'application/json':
        return 'csrf_rejected'
    if value['cookieCount'] > 1:
        return 'cookie_ambiguous'
    if value['cookieCount'] != 1 or value['credentialKind'] != 'auth' or value['credentialContext'] != value['context']:
        return 'session_invalid'
    if value['state'] != 'authenticated' or value['now'] >= min(value['lastSeenAt'] + IDLE, value['authenticatedAt'] + ABSOLUTE):
        return 'session_invalid'
    if value['expectedAccount'] != value['account']:
        return 'account_mismatch'
    if check_owner and (not epoch(value['requestEpoch']) or value['requestEpoch'] != value['ownerEpoch'] or value['requestTab'] != value['ownerTab']):
        return 'owner_lost'
    return 'ok'


def decide(case):
    """Specification oracle; adapters in02b must exercise the same vectors independently."""
    value, kind = case['input'], case['kind']
    if kind == 'remote':
        code = remote_guard(value)
        return {'code': code, 'idleExpiresAt': min(value['now'] + IDLE, value['authenticatedAt'] + ABSOLUTE) if code == 'ok' else None}
    if kind == 'claim':
        code = remote_guard(value, check_owner=False)
        if code == 'ok':
            candidate = value['requestEpoch']
            if not epoch(candidate) or int(candidate) < int(value['ownerEpoch']) or (candidate == value['ownerEpoch'] and value['requestTab'] != value['ownerTab']):
                code = 'owner_lost'
        return {'code': code}
    if kind == 'capacity':
        count = sum(phase != 'terminal' for phase in value['phases'])
        return {'code': 'auth_context_limit' if count >= POLICY['session']['maxLocalContexts'] else 'ok'}
    if kind == 'local':
        code = 'ok'
        if value['state'] != 'active':
            code = 'local_locked'
        elif value['account'] != value['capturedAccount'] or value['generation'] != value['capturedGeneration']:
            code = 'stale_journey'
        elif not epoch(value['ownerEpoch']) or value['ownerEpoch'] == '0' or value['ownerEpoch'] != value['capturedEpoch'] or value['ownerTab'] != value['capturedTab'] or not value['hasPresence']:
            code = 'owner_lost'
        elif value['compatibility'] != 'compatible':
            code = 'upgrade_required'
        return {'code': code}
    if kind == 'journal':
        permitted = value['to'] in POLICY['journalTransitions'][value['from']]
        if value['to'] == 'terminal':
            proof = value['proof']
            permitted = permitted and (proof in ['closed', 'expired', 'recovered', 'expired_unbound', 'closed_unbound'] or
                                      (proof == 'not_dispatched' and not value['prepareDispatched']))
        return {'code': 'ok' if permitted else 'preserve_blocked'}
    if kind == 'snapshot':
        complete = value['stagingComplete'] and set(value['pendingAtCommit']).issubset(value['classifiedAtH'])
        return {'code': 'ok' if complete else 'snapshot_incomplete'}
    if kind == 'activation':
        valid = value['context'] == value['expectedContext'] and value['installation'] == value['expectedInstallation']
        valid = valid and (value['expectedAccount'] is None or value['account'] == value['expectedAccount'])
        valid = valid and value['generation'] == value['capturedGeneration'] and value['ownerEpoch'] == value['capturedEpoch']
        return {'code': 'ok' if valid else 'stale_activation'}
    if kind == 'recovery':
        code = 'ok'
        if not value['passwordValid']:
            code = 'invalid_credentials'
        elif value['provedAccount'] != value['contextAccount'] or not value['contextExists']:
            code = 'context_unavailable'
        return {'code': code, 'createsSession': False}
    if kind == 'authenticate':
        code = 'ok'
        if value['state'] in ['closed', 'expired']:
            code = 'context_closed'
        elif value['state'] == 'authenticated':
            code = 'context_conflict'
        elif value['now'] >= value['reservationExpiresAt']:
            code = 'preparation_expired'
        elif not value['closeCookieProved'] or not value['passwordValid']:
            code = 'invalid_credentials'
        elif value['expectedAccount'] is not None and value['expectedAccount'] != value['provedAccount']:
            code = 'account_mismatch'
        return {'code': code, 'issuesAuth': code == 'ok'}
    raise ValueError('Unknown scenario kind: ' + kind)


def schema_for(item):
    source = LOCAL if item['scope'] == 'local' else API
    schema = deepcopy(source)
    schema['$ref'] = ('#/$defs/' if item['scope'] == 'local' else '#/components/schemas/') + item['schema']
    return Draft202012Validator(schema, format_checker=FormatChecker())


def validate_semantics(item):
    value = item['value']
    if item['schema'] == 'Epoch':
        return epoch(value)
    for field in ['owner_epoch', 'ownerEpoch', 'epoch']:
        if field in value and not epoch(value[field]):
            return False
    if item['schema'] == 'WebSession':
        authenticated, idle, absolute = (datetime.fromisoformat(value[key].replace('Z', '+00:00')) for key in
                                         ['authenticatedAt', 'idleExpiresAt', 'absoluteExpiresAt'])
        return value['accountId'] == value['profile']['accountId'] and value['ownerEpoch'] != '0' and (absolute - authenticated).total_seconds() == ABSOLUTE and authenticated < idle <= absolute
    if item['schema'] == 'ChallengeResponse':
        issued, ticket, reservation, close = (datetime.fromisoformat(value[key].replace('Z', '+00:00')) for key in
                                             ['issuedAt', 'ticketExpiresAt', 'reservationExpiresAt', 'closeCookieExpiresAt'])
        return (ticket - issued).total_seconds() == POLICY['preparation']['ticketSeconds'] and (reservation - issued).total_seconds() == POLICY['preparation']['reservationSeconds'] and (close - issued).total_seconds() == POLICY['preparation']['closeCookieSeconds']
    if item['schema'] == 'AuthJournal' and value['account_id'] is not None and value['expected_account_id'] is not None:
        return value['account_id'] == value['expected_account_id']
    if item['schema'] == 'Mutation':
        envelope = value['envelope']
        return value['operation_id'] == envelope['operationId'] and value['device_id'] == envelope['deviceId'] and value['client_sequence'] == envelope['clientSequence'] and value['dependencies'] == envelope['dependsOn']
    if item['schema'] in ['Canonical', 'Staging']:
        payload = value['payload']
        return value['kind'] == payload['kind'] and value['revision'] == payload['value']['revision'] and (payload['kind'] != 'profile' or value['account_id'] == payload['value']['accountId'])
    return True


def main():
    validate_spec(API)
    Draft202012Validator.check_schema(LOCAL)
    assert POLICY['session'] == {'idleSeconds': 30 * 86400, 'absoluteSeconds': 90 * 86400, 'maxLocalContexts': 4}
    assert POLICY['preparation']['closeCookieSeconds'] > ABSOLUTE + POLICY['preparation']['reservationSeconds']
    assert POLICY['preparation']['ticketSeconds'] < POLICY['preparation']['reservationSeconds']
    assert POLICY['cookies']['path'].endswith('/{contextId}/')
    assert POLICY['retention']['minimumTombstones'] == 'no-automatic-purge-m1'
    assert POLICY['cookies']['domain'] is None and POLICY['cookies']['maxAge'] is None
    assert POLICY['cookies']['secure'] and POLICY['cookies']['httpOnly'] and POLICY['cookies']['sameSite'] == 'Strict'
    assert POLICY['http']['maxCookieHeaderBytes'] < POLICY['http']['requiredIngressHeaderBytes']
    base = read('../primeiro-marco/openapi.json')
    for path, methods in API['paths'].items():
        assert set(methods) == {'post'}, path
        operation = methods['post']
        parameters = {p['name']: p for p in operation['parameters'] if p['in'] == 'header'}
        assert parameters['Origin']['required'] and parameters['X-Ritmo-Web']['schema']['const'] == '1'
        for header in ['X-App-Version', 'X-Ritmo-Protocol']:
            native = next(p['schema'] for p in base['paths']['/sync/push']['post']['parameters'] if p['name'] == header)
            assert parameters[header]['schema'] == native
        credential = operation['x-credential']
        assert operation['security'] == ([] if credential == 'none' else [{'webAuth' if credential == 'auth' else 'webClose': []}])
        if '/sync/' in path:
            assert credential == 'auth' and operation['x-owner-required']
            assert parameters['X-Ritmo-Expected-Account']['required']
        if operation['x-owner-required']:
            assert parameters['X-Ritmo-Owner-Epoch']['required'] and parameters['X-Ritmo-Owner-Tab']['required']
        assert list(operation['requestBody']['content']) == ['application/json']
    # Copying a schema must not silently fork domain semantics.
    for name, schema in API['components']['schemas'].items():
        if name in base['components']['schemas']:
            assert schema == base['components']['schemas'][name], name
    examples = read('examples.json')
    for item in examples:
        valid = not list(schema_for(item).iter_errors(item['value']))
        valid = valid and validate_semantics(item)
        assert valid == item['valid'], item['name']
    scenarios = read('scenarios.json')
    for case in scenarios:
        assert decide(case) == case['expected'], case['name']
    assert len({case['name'] for case in scenarios}) == len(scenarios)
    assert set(case['kind'] for case in scenarios) == {'remote', 'claim', 'capacity', 'local', 'journal', 'snapshot', 'activation', 'recovery', 'authenticate'}
    assert any(not x['valid'] for x in examples) and any(x['valid'] for x in examples)
    report = {'scope': 'Design only: OpenAPI/JSON Schema, fixtures and specification oracle. No HTTP, cookies, SQL or IndexedDB exercised.',
        'paths': len(API['paths']), 'transport_schemas': len(API['components']['schemas']), 'local_record_schemas': len(LOCAL['$defs']),
        'examples': len(examples), 'positive': sum(x['valid'] for x in examples), 'negative': sum(not x['valid'] for x in examples),
        'decision_scenarios': len(scenarios), 'domain_contract_unchanged': True}
    (ROOT / 'validation-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
