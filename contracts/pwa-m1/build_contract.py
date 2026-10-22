"""Generate a design contract; never imports or changes application code."""
from copy import deepcopy
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
BASE = json.loads((ROOT.parent / 'primeiro-marco/openapi.json').read_text(encoding='utf-8'))


def obj(properties):
    return {'type': 'object', 'properties': properties, 'required': list(properties), 'additionalProperties': False}


def ref(name):
    return {'$ref': '#/components/schemas/' + name}


def nullable(schema):
    return {'anyOf': [schema, {'type': 'null'}]}


def enum(*values):
    return {'type': 'string', 'enum': list(values)}


schemas = {}


def native(name):
    if name in schemas:
        return
    value = deepcopy(BASE['components']['schemas'][name])
    schemas[name] = value
    for dependency in re.findall(r'#/components/schemas/([^"\s]+)', json.dumps(value)):
        native(dependency)


for name in ['Id', 'Instant', 'AccountProfile', 'Email', 'Password', 'PushRequest', 'PushResponse', 'PullResponse',
             'SnapshotManifest', 'SnapshotPage', 'ReceiptsRequest', 'ReceiptsResponse', 'ResetRequest', 'ResetConfirmRequest', 'ApiError']:
    native(name)

schemas['Epoch'] = {'type': 'string', 'pattern': '^(0|[1-9][0-9]{0,18})$', 'maxLength': 19,
                    'description': 'Decimal; semantic maximum 9223372036854775807.'}
schemas['PreparationTicket'] = {'type': 'string', 'minLength': 32, 'maxLength': 2048,
    'description': 'Signed preparation permission, not session authentication. Memory only.'}
schemas['Empty'] = obj({})
schemas['ChallengeRequest'] = obj({'attemptId': ref('Id'), 'installationId': ref('Id'), 'expectedAccountId': nullable(ref('Id'))})
schemas['ChallengeResponse'] = obj({'attemptId': ref('Id'), 'contextId': ref('Id'), 'installationId': ref('Id'),
    'issuedAt': ref('Instant'), 'ticketExpiresAt': ref('Instant'), 'reservationExpiresAt': ref('Instant'),
    'closeCookieExpiresAt': ref('Instant'), 'preparationTicket': ref('PreparationTicket')})
schemas['PrepareRequest'] = obj({'preparationTicket': ref('PreparationTicket')})
schemas['PreparationReceipt'] = obj({'contextId': ref('Id'), 'installationId': ref('Id'),
    'reservationExpiresAt': ref('Instant'), 'closeCookieExpiresAt': ref('Instant')})
schemas['ReservationProof'] = obj({'contextId': ref('Id'), 'state': enum('reserved', 'expired_unbound', 'closed_unbound', 'proof_required'),
    'reservationExpiresAt': ref('Instant')})
schemas['WebLoginRequest'] = obj({'email': ref('Email'), 'password': ref('Password'), 'deviceId': ref('Id')})
schemas['WebRegisterRequest'] = obj({**schemas['WebLoginRequest']['properties'], 'displayName': {'type': 'string', 'minLength': 1, 'maxLength': 80}})
schemas['WebSession'] = obj({'contextId': ref('Id'), 'installationId': ref('Id'), 'accountId': ref('Id'),
    'authenticatedAt': ref('Instant'), 'idleExpiresAt': ref('Instant'), 'absoluteExpiresAt': ref('Instant'),
    'ownerEpoch': ref('Epoch'), 'ownerTabId': ref('Id'), 'profile': ref('AccountProfile')})
schemas['OwnerClaim'] = obj({'epoch': ref('Epoch'), 'tabId': ref('Id')})
schemas['OwnerReceipt'] = obj({'contextId': ref('Id'), 'epoch': ref('Epoch'), 'tabId': ref('Id')})
schemas['CloseReceipt'] = obj({'contextId': ref('Id'), 'state': enum('closed', 'expired')})
schemas['RecoveryCloseRequest'] = obj({'contextId': ref('Id'), 'email': ref('Email'), 'password': ref('Password')})
schemas['PullRequest'] = obj({'cursor': nullable(ref('Opaque')), 'limit': {'type': 'integer', 'minimum': 1, 'maximum': 500}})
schemas['SnapshotPageRequest'] = obj({'pageCursor': nullable(ref('Opaque'))})
schemas['WebError'] = deepcopy(schemas['ApiError'])
schemas['WebError']['properties']['error']['properties']['code']['enum'] += ['csrf_rejected', 'preparation_expired',
    'context_conflict', 'context_unavailable', 'context_closed', 'cookie_ambiguous', 'account_mismatch', 'owner_lost', 'headers_too_large', 'auth_context_limit']
headers = {'Origin': {'type': 'string', 'description': 'Exact configured HTTPS origin; missing/null rejected.'},
    'X-Ritmo-Web': {'type': 'string', 'const': '1'}, 'X-App-Version': {'type': 'string', 'minLength': 1, 'maxLength': 64},
    'X-Ritmo-Protocol': {'type': 'string', 'const': 'm1.1'}}
for header in ['X-App-Version', 'X-Ritmo-Protocol']:
    headers[header] = deepcopy(next(p['schema'] for p in BASE['paths']['/sync/push']['post']['parameters'] if p['name'] == header))
paths = {}
prefix = '/contexts/{contextId}'


def route(path, operation, request, response, credential='none', owner=False, expected=False, bucket='refresh', status='200'):
    parameters = [{'name': key, 'in': 'header', 'required': True, 'schema': value} for key, value in headers.items()]
    if owner:
        parameters += [{'name': key, 'in': 'header', 'required': True, 'schema': value} for key, value in
                      {'X-Ritmo-Owner-Epoch': ref('Epoch'), 'X-Ritmo-Owner-Tab': ref('Id')}.items()]
    if expected:
        parameters.append({'name': 'X-Ritmo-Expected-Account', 'in': 'header', 'required': True, 'schema': ref('Id')})
    parameters += [{'name': key, 'in': 'path', 'required': True, 'schema': ref('Id')} for key in re.findall(r'{(\w+)}', path)]
    responses = {status: {'description': 'Public metadata or m1.1 domain response; see README.md.',
        'content': {'application/json': {'schema': ref(response)}},
        'headers': {'Cache-Control': {'schema': {'type': 'string', 'const': 'no-store'}}}}}
    for code in ['400', '401', '403', '404', '409', '410', '413', '426', '429', '431', '503']:
        responses[code] = {'description': 'Typed error; applicability/action in README.md.',
                          'content': {'application/json': {'schema': ref('WebError')}}}
    paths[path] = {'post': {'operationId': operation, 'security': [] if credential == 'none' else [{'webAuth' if credential == 'auth' else 'webClose': []}], 'parameters': parameters,
        'x-credential': credential, 'x-rate-bucket': bucket, 'x-owner-required': owner,
        'requestBody': {'required': True, 'content': {'application/json': {'schema': ref(request)}}}, 'responses': responses}}


route('/auth/challenge', 'webChallenge', 'ChallengeRequest', 'ChallengeResponse')
route('/auth/prepare', 'webPrepare', 'PrepareRequest', 'PreparationReceipt')
route(prefix + '/reservation-status', 'webReservationStatus', 'Empty', 'ReservationProof')
route(prefix + '/confirm-reservation', 'webConfirmReservation', 'Empty', 'PreparationReceipt', 'close')
route(prefix + '/login', 'webLogin', 'WebLoginRequest', 'WebSession', 'close', owner=True, bucket='login')
route(prefix + '/register', 'webRegister', 'WebRegisterRequest', 'WebSession', 'close', owner=True, bucket='register', status='201')
route(prefix + '/inspect', 'webInspect', 'Empty', 'WebSession', 'auth', owner=True)
route(prefix + '/claim-owner', 'webClaimOwner', 'OwnerClaim', 'OwnerReceipt', 'auth')
route(prefix + '/close', 'webClose', 'Empty', 'CloseReceipt', 'close', bucket='revoke')
route('/auth/recovery-close', 'webRecoveryClose', 'RecoveryCloseRequest', 'CloseReceipt', bucket='login+revoke')
route('/auth/password-reset/request', 'webResetRequest', 'ResetRequest', 'Empty', bucket='reset-request', status='202')
route('/auth/password-reset/confirm', 'webResetConfirm', 'ResetConfirmRequest', 'Empty', bucket='reset-confirm')
route(prefix + '/sync/push', 'webPush', 'PushRequest', 'PushResponse', 'auth', owner=True, expected=True, bucket='account')
route(prefix + '/sync/pull', 'webPull', 'PullRequest', 'PullResponse', 'auth', owner=True, expected=True, bucket='account')
route(prefix + '/sync/snapshots', 'webSnapshot', 'Empty', 'SnapshotManifest', 'auth', owner=True, expected=True, bucket='account', status='201')
route(prefix + '/sync/snapshots/{snapshotId}', 'webSnapshotPage', 'SnapshotPageRequest', 'SnapshotPage', 'auth', owner=True, expected=True, bucket='account')
route(prefix + '/sync/receipts', 'webReceipts', 'ReceiptsRequest', 'ReceiptsResponse', 'auth', owner=True, expected=True, bucket='account')
paths[prefix + '/sync/push']['post']['parameters'].append({'name': 'Idempotency-Key', 'in': 'header', 'required': True, 'schema': ref('Id')})
api = {'openapi': '3.1.1', 'info': {'title': 'Ritmo — PWA M1, contrato 02a', 'version': '0.1.0',
    'description': 'Server adapters implemented in slice09/02b. Browser storage/product journey and Safari acceptance remain pending. Domain protocol remains m1.1. See README.md.'},
    'servers': [{'url': '/api/v1/web'}], 'paths': paths, 'components': {'schemas': schemas, 'securitySchemes': {
        'webAuth': {'type': 'apiKey', 'in': 'cookie', 'name': '__Secure-ritmo-auth'},
        'webClose': {'type': 'apiKey', 'in': 'cookie', 'name': '__Secure-ritmo-close'}}},
    'x-cookie-authentication': 'Context-scoped cookie per x-credential. Public context ID never authorizes; no bearer fallback.'}
id_type, instant, epoch = (deepcopy(schemas[key]) for key in ['Id', 'Instant', 'Epoch'])
counter = {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991}
local = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$defs': {
    'Control': obj({'singleton': {'const': 1}, 'installation_id': id_type, 'schema_version': {'const': 1},
        'session_state': enum('active', 'logging_out', 'locked'), 'session_generation': counter,
        'selected_account_id': nullable(id_type), 'selected_context_id': nullable(id_type),
        'owner_tab_id': nullable(id_type), 'owner_epoch': epoch}),
    'AuthJournal': obj({'attempt_id': id_type, 'context_id': nullable(id_type), 'installation_id': id_type,
        'expected_account_id': nullable(id_type), 'account_id': nullable(id_type), 'session_generation': counter,
        'prepare_dispatched': {'type': 'boolean'},
        'owner_epoch': epoch, 'owner_tab_id': id_type,
        'phase': enum('challenging', 'preparing', 'reserved', 'active', 'close_pending', 'recovery_required', 'terminal'),
        'reservation_expires_at': nullable(instant), 'close_cookie_expires_at': nullable(instant),
        'terminal_proof': nullable(enum('not_dispatched', 'expired_unbound', 'closed_unbound', 'closed', 'expired', 'recovered'))}),
    'Compatibility': obj({'build_id': {'type': 'string', 'minLength': 1, 'maxLength': 64},
        'protocol_version': {'const': 'm1.1'}, 'schema_version': {'const': 1},
        'state': enum('unknown', 'compatible', 'upgrade_required'), 'checked_at': nullable(instant)}),
    'Appearance': obj({'version': {'const': 1}, 'skin': enum('holo', 'cockpit', 'neo'), 'mode': enum('system', 'light', 'dark')})}}
local['$defs']['Control']['allOf'] = [{'if': {'properties': {'session_state': {'const': 'active'}}},
    'then': {'properties': {'selected_account_id': id_type, 'selected_context_id': id_type}},
    'else': {'properties': {'selected_account_id': {'type': 'null'}, 'selected_context_id': {'type': 'null'}}}}]
local['$defs']['AuthJournal']['allOf'] = [
    {'if': {'properties': {'phase': {'const': 'active'}}}, 'then': {'properties': {'account_id': id_type, 'context_id': id_type}}},
    {'if': {'properties': {'phase': {'const': 'challenging'}}}, 'then': {'properties': {'context_id': {'type': 'null'}, 'prepare_dispatched': {'const': False}}}},
    {'if': {'properties': {'phase': {'enum': ['preparing', 'reserved', 'active', 'close_pending', 'recovery_required']}}},
     'then': {'properties': {'context_id': id_type}}},
    {'if': {'properties': {'terminal_proof': {'const': 'not_dispatched'}}},
     'then': {'properties': {'prepare_dispatched': {'const': False}}}},
    {'if': {'properties': {'phase': {'const': 'terminal'}}}, 'then': {'properties': {'terminal_proof': {'type': 'string'}}},
     'else': {'properties': {'terminal_proof': {'type': 'null'}}}}]
local['components'] = {'schemas': schemas}
queue_error = obj({'code': {'type': 'string', 'minLength': 1, 'maxLength': 160},
    'fields': {'type': 'array', 'items': ref('FieldError')},
    'dependencyIds': {'type': 'array', 'items': id_type}})
queue_error['properties']['identity'] = obj({'reason': enum('missing_proof', 'content_mismatch', 'operation', 'sequence'),
    'localOperationHash': ref('OperationHash')})
queue_error['properties']['identity']['properties'].update({
    'originalOperationId': id_type, 'originalOperationHash': ref('OperationHash'),
    'originalReceipt': ref('Receipt'), 'conflictReceipt': ref('Receipt')})
queue_error['properties']['resolution'] = {'oneOf': [obj({'kind': {'const': 'discarded'}}),
    obj({'kind': {'const': 'corrected'}, 'replacementOperationId': id_type})]}
local['$defs'].update({
    'Account': obj({'account_id': id_type, 'state': enum('ready', 'blocked')}),
    'Canonical': obj({'account_id': id_type, 'kind': {'type': 'string'}, 'entity_key': {'type': 'string', 'minLength': 1},
        'revision': ref('Revision'), 'payload': ref('Entity')}),
    'Mutation': obj({'account_id': id_type, 'operation_id': id_type, 'device_id': id_type,
        'client_sequence': {'type': 'integer', 'minimum': 1, 'maximum': 9007199254740991},
        'envelope': ref('Operation'), 'dependencies': {'type': 'array', 'items': id_type, 'maxItems': 4096},
        'status': enum('pending', 'in_flight', 'retry_wait', 'deferred', 'blocked_local', 'rejected', 'acknowledged'),
        'attempts': {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991},
        'next_attempt_at': nullable(instant), 'error': nullable(queue_error), 'result': nullable(ref('Receipt'))}),
    'SyncState': obj({'account_id': id_type, 'cursor': nullable(ref('Opaque')),
        'next_sequence': {'type': 'integer', 'minimum': 1, 'maximum': 9007199254740991},
        'onboarding_step': enum('time_context', 'first_habit', 'complete'), 'snapshot_id': nullable(id_type),
        'snapshot_revision': nullable(ref('Revision')), 'snapshot_cursor': nullable(ref('Opaque')), 'snapshot_expires_at': nullable(instant)}),
    'Staging': obj({'account_id': id_type, 'snapshot_id': id_type, 'kind': {'type': 'string'},
        'entity_key': {'type': 'string', 'minLength': 1}, 'revision': ref('Revision'), 'payload': ref('Entity')}),
    'Projection': obj({'account_id': id_type, 'kind': enum('habit', 'xp'), 'entity_key': {'type': 'string', 'minLength': 1},
        'payload': {'oneOf': [obj({'habitId': id_type, 'title': {'type': 'string'}, 'done': {'type': 'boolean'}}),
            obj({'totalXp': {'type': 'integer'}})]}})})
policy = {'version': 1, 'session': {'idleSeconds': 2592000, 'absoluteSeconds': 7776000, 'maxLocalContexts': 4},
    'preparation': {'ticketSeconds': 300, 'reservationSeconds': 600, 'closeCookieSeconds': 7862400},
    'cookies': {'auth': '__Secure-ritmo-auth', 'close': '__Secure-ritmo-close', 'path': '/api/v1/web/contexts/{contextId}/',
        'secure': True, 'httpOnly': True, 'sameSite': 'Strict', 'domain': None, 'maxAge': None,
        'expiry': 'fixed-absolute', 'secretBytes': 32, 'duplicatePolicy': 'reject'},
    'http': {'maxCookieHeaderBytes': 8192, 'requiredIngressHeaderBytes': 16384, 'cacheControl': 'no-store',
        'csrfHeader': 'X-Ritmo-Web', 'csrfHeaderValue': '1', 'origin': 'exact-configured-https', 'cors': 'deny-cross-origin'},
    'retention': {'secretHashes': 'until-close-expiry', 'minimumTombstones': 'no-automatic-purge-m1'},
    'journalTransitions': {'challenging': ['preparing', 'terminal'], 'preparing': ['reserved', 'close_pending', 'recovery_required', 'terminal'],
        'reserved': ['active', 'close_pending', 'recovery_required', 'terminal'], 'active': ['close_pending', 'recovery_required'],
        'close_pending': ['terminal', 'recovery_required'], 'recovery_required': ['close_pending', 'terminal'], 'terminal': []}}
for filename, value in [('openapi.json', api), ('local.schema.json', local), ('policy.json', policy)]:
    (ROOT / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print('Built design:', len(paths), 'POST paths;', len(schemas), 'transport schemas.')
