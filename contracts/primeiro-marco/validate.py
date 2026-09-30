"""Validate transport schemas and fixtures; does not test a running application."""
import json
import sqlite3
import unicodedata
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / '.scratch' / 'contract-tools'))
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate as validate_openapi
from pglast import parse_sql

api = json.loads((ROOT / 'openapi.json').read_text(encoding='utf-8'))
fixtures = json.loads((ROOT / 'examples.json').read_text(encoding='utf-8'))
validate_openapi(api)
for name, schema in api['components']['schemas'].items():
    Draft202012Validator.check_schema(schema)
passed = 0
for item in fixtures:
    schema = {'$ref': '#/components/schemas/' + item['schema'], 'components': api['components']}
    errors = list(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(item['value']))
    if bool(errors) == item['valid']:
        raise AssertionError(f"{item['name']}: expected valid={item['valid']}; errors={[e.message for e in errors]}")
    passed += 1

# Shape is not enough: these relationships are deliberately checked separately.
for item in fixtures:
    if not item['valid']: continue
    value = item['value']
    if item['schema'] == 'SnapshotPage':
        assert value['complete'] == (value['nextPageCursor'] is None)
        assert value['complete'] == (value['pullCursor'] is not None)
    if item['schema'] == 'PullResponse':
        revisions = [int(c['revision']) for c in value['changes']]
        assert revisions == sorted(set(revisions))
        assert all(r <= int(value['highWaterRevision']) for r in revisions)
        for change in value['changes']:
            assert all(r['acceptedRevision'] == change['revision'] for r in change['operationResults'])
            assert all(e['value']['revision'] == change['revision'] for e in change['entities'])
    if item['schema'] == 'ReceiptsResponse':
        assert all('acceptedRevision' not in r or int(r['acceptedRevision']) <= int(value['highWaterRevision']) for r in value['results'])

report = {'openapi': api['openapi'], 'schemas': len(api['components']['schemas']),
          'endpoints': len(api['paths']), 'fixtures_passed': passed,
          'positive': sum(x['valid'] for x in fixtures), 'negative': sum(not x['valid'] for x in fixtures),
          'scope': 'Transport document, JSON Schema fixtures, PostgreSQL syntax and SQLite constraints. No server/mobile integration or PostgreSQL execution tested.'}
report['postgres_statements_parsed'] = len(parse_sql((ROOT/'postgres.sql').read_text(encoding='utf-8')))
db = sqlite3.connect(':memory:')
db.executescript((ROOT/'sqlite.sql').read_text(encoding='utf-8'))
db.execute("INSERT INTO account_storage(account_id) VALUES ('A')")
db.commit()
checks = 0
def refuses(sql, values=()):
    global checks
    try:
        with db: db.execute(sql, values)
    except sqlite3.IntegrityError:
        checks += 1
    else:
        raise AssertionError('SQLite accepted invalid row: ' + sql)
refuses("INSERT INTO account_storage(account_id) VALUES ('B')")
refuses("INSERT INTO canonical_entities VALUES ('B','habit','H','1','{}')")
refuses("INSERT INTO canonical_entities VALUES ('A','habit','H','9223372036854775808','{}')")
refuses("INSERT INTO canonical_entities VALUES ('A','habit','H','01','{}')")
refuses("INSERT INTO canonical_entities VALUES ('A','habit','H','1','invalid json')")
insert_mutation = "INSERT INTO sync_mutations(account_id,operation_id,device_id,client_sequence,envelope,dependencies,status) VALUES (?,?,?,?,?,?,?)"
row=('A','op1','device1',1,'{}','[]','pending')
with db: db.execute(insert_mutation,row)
refuses(insert_mutation,row)
refuses(insert_mutation,('A','op2','device1',1,'{}','[]','pending'))
try:
    with db:
        db.execute(insert_mutation,('A','op3','device1',3,'{}','[]','pending'))
        db.execute("INSERT INTO projected_views VALUES ('A','habit','H','{}')")
        raise RuntimeError('simulated failure before commit')
except RuntimeError:
    assert db.execute("SELECT COUNT(*) FROM sync_mutations WHERE operation_id='op3'").fetchone()[0] == 0
    assert db.execute('SELECT COUNT(*) FROM projected_views').fetchone()[0] == 0
    checks += 1
report['sqlite_checks_passed'] = checks
domain = json.loads((ROOT/'domain-fixtures.json').read_text(encoding='utf-8'))
for case in domain['titleKey']:
    assert ' '.join(unicodedata.normalize('NFKC',case['input']).casefold().split()) == case['expected']
for case in domain['emailKey']:
    assert case['input'].isascii()
    assert case['input'].strip().lower() == case['expected']
for case in domain['xpBudget']:
    n=case['dueHabits']
    assert max(150,15*n)==case['expectedLimit']
    assert 10*n<=case['expectedLimit']
report['domain_fixture_checks_passed'] = sum(len(x) for x in domain.values())
report['normalization_reference_unicode'] = unicodedata.unidata_version
(ROOT/'validation-result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(report,ensure_ascii=False))
