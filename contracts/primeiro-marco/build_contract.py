"""Rebuild the M1 transport contract. No application or server is implemented here."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
S = {}
def ref(name): return {"$ref": f"#/components/schemas/{name}"}
def obj(props, optional=()):
    return {"type": "object", "properties": props,
            "required": [k for k in props if k not in optional], "additionalProperties": False}
def arr(item, maximum=500, minimum=0, unique=False):
    return {"type": "array", "items": item, "minItems": minimum, "maxItems": maximum, **({"uniqueItems": True} if unique else {})}
def text(maximum=120, minimum=1): return {"type": "string", "minLength": minimum, "maxLength": maximum}
def enum(*values): return {"type": "string", "enum": list(values)}
def nullable(schema): return {"anyOf": [schema, {"type": "null"}]}
def integer(low=0, high=2147483647): return {"type": "integer", "minimum": low, "maximum": high}

S['Id'] = {"type": "string", "format": "uuid", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"}
S['Revision'] = {"type": "string", "pattern": "^(0|[1-9][0-9]{0,18})$", "description": "Decimal signed int64, additionally <= 9223372036854775807; compare numerically."}
S['Instant'] = {"type": "string", "format": "date-time", "pattern": "Z$"}
S['Day'] = {"type": "string", "format": "date", "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"}
S['Opaque'] = {**text(2048, 16), "pattern": "^[A-Za-z0-9_.-]+$"}
S['Secret'] = {**text(4096, 32), "writeOnly": True, "description": "Credential, never log. Fixtures use fake values."}
S['TimeContext'] = obj({'timezone': text(100), 'dayStartHour': integer(0,23)})
S['Email'] = {**text(254,3), 'format':'email', 'description':'ASCII email, normalized per README; no Gmail-specific aliases.'}
S['Password'] = {**text(128,8), 'writeOnly':True, 'description':'Count Unicode code points. Never trim or normalize.'}
S['MetadataPatch'] = {**obj({'title':text(), 'iconKey':nullable(text(64)), 'colorToken':nullable(text(64)), 'sortOrder':integer(0,1000000)}, ('title','iconKey','colorToken','sortOrder')), 'minProperties':1}
S['OnboardingCommand'] = obj({'type':{'const':'profile.setOnboarding'}, 'timeContext':ref('TimeContext'), 'completed':{'type':'boolean'}, 'analyticsConsent':{'type':'boolean'}})
S['CreateHabitCommand'] = obj({'type':{'const':'habit.create'},'habitId':ref('Id'),'title':text(),'habitType':{'const':'binary'},'scheduleKind':{'const':'daily'},'startDayKey':ref('Day'),'timeContext':ref('TimeContext'),'iconKey':nullable(text(64)),'colorToken':nullable(text(64)),'sortOrder':integer(0,1000000)})
S['PatchHabitCommand'] = obj({'type':{'const':'habit.patchMetadata'},'habitId':ref('Id'),'patch':ref('MetadataPatch')})
S['MarkCommand'] = obj({'type':{'const':'habit.mark'},'habitId':ref('Id'),'dayKey':ref('Day'),'timeContext':ref('TimeContext'),'observedUndoIds':arr(ref('Id'),4096,unique=True)})
S['UnmarkCommand'] = obj({'type':{'const':'habit.unmark'},'habitId':ref('Id'),'dayKey':ref('Day'),'timeContext':ref('TimeContext')})
S['Command'] = {'oneOf':[ref(x) for x in ('OnboardingCommand','CreateHabitCommand','PatchHabitCommand','MarkCommand','UnmarkCommand')]}
S['Operation'] = obj({'operationId':ref('Id'),'deviceId':ref('Id'),'clientSequence':integer(1,9007199254740991),'occurredAt':ref('Instant'),'dependsOn':arr(ref('Id'),4096,unique=True),'supersedesOperationId':nullable(ref('Id')),'command':ref('Command')},('supersedesOperationId',))
S['AccountProfile'] = obj({'accountId':ref('Id'),'displayName':text(80),'timeContext':ref('TimeContext'),'plan':{'const':'free'},'onboardedAt':nullable(ref('Instant')),'analyticsConsentAt':nullable(ref('Instant')),'revision':ref('Revision')})
S['Habit'] = obj({'habitId':ref('Id'),'title':text(),'habitType':{'const':'binary'},'scheduleKind':{'const':'daily'},'startDayKey':ref('Day'),'creationTimeContext':ref('TimeContext'),'iconKey':nullable(text(64)),'colorToken':nullable(text(64)),'sortOrder':integer(0,1000000),'createdAt':ref('Instant'),'updatedAt':ref('Instant'),'deletedAt':nullable(ref('Instant')),'revision':ref('Revision')})
S['HabitDay'] = obj({'habitDayId':ref('Id'),'habitId':ref('Id'),'dayKey':ref('Day'),'done':{'type':'boolean'},'knownUndoIds':arr(ref('Id'),4096,unique=True),'revision':ref('Revision')})
S['XpGrant'] = obj({'grantId':ref('Id'),'habitDayId':ref('Id'),'amount':{'type':'integer','const':10},'dayKey':ref('Day'),'module':{'const':'habits'},'budgetCost':{'type':'integer','const':10},'active':{'type':'boolean'},'revision':ref('Revision')})
S['XpDecision'] = {'oneOf':[
    obj({'habitDayId':ref('Id'),'outcome':{'const':'granted'},'grantId':ref('Id'),'revision':ref('Revision')}),
    obj({'habitDayId':ref('Id'),'outcome':{'const':'limit_reached'},'grantId':{'type':'null'},'revision':ref('Revision')})]}
S['XpTransition'] = obj({'operationId':ref('Id'),'grantId':ref('Id'),'kind':enum('grant','reverse','restore'),'acceptedAt':ref('Instant'),'revision':ref('Revision')})
S['XpBudget'] = obj({'dayKey':ref('Day'),'module':{'const':'habits'},'consumed':integer(),'dueHabitCount':integer(),'limit':integer(150),'revision':ref('Revision')})
S['Tombstone'] = obj({'entityKind':enum('habit'),'entityId':ref('Id'),'deletedAt':ref('Instant'),'revision':ref('Revision')})
KINDS = {'profile':'AccountProfile','habit':'Habit','habitDay':'HabitDay','xpGrant':'XpGrant','xpDecision':'XpDecision','xpTransition':'XpTransition','xpBudget':'XpBudget','tombstone':'Tombstone'}
S['Entity'] = {'oneOf':[obj({'kind':{'const':kind},'value':ref(schema)}) for kind,schema in KINDS.items()]}
S['FieldError'] = obj({'path':text(200),'code':enum('required','invalid','too_long','out_of_range','not_unique')})
BUSINESS = ('validation_failed','title_unavailable','resource_inaccessible','day_invalid','id_content_conflict','dependency_rejected','dependency_cycle','context_limit_reached')
S['BusinessError'] = obj({'code':enum(*BUSINESS),'fields':arr(ref('FieldError'),50),'dependencyIds':arr(ref('Id'),4096,unique=True)})
S['Receipt'] = obj({'operationId':ref('Id'),'status':enum('accepted','reconciled'),'acceptedRevision':ref('Revision')})
S['RejectedReceipt'] = obj({'operationId':ref('Id'),'status':{'const':'rejected'},'error':ref('BusinessError')})
S['AcceptedResult'] = obj({'receipt':ref('Receipt'),'replayed':{'type':'boolean'},'projections':arr(ref('Entity'),32)})
S['RejectedResult'] = obj({'receipt':ref('RejectedReceipt'),'replayed':{'type':'boolean'}})
S['DeferredResult'] = obj({'operationId':ref('Id'),'status':{'const':'deferred'},'missingDependencyIds':arr(ref('Id'),4096,1,True)})
S['PushRequest'] = obj({'operations':arr(ref('Operation'),50,1)})
S['PushResponse'] = obj({'results':arr({'oneOf':[ref('AcceptedResult'),ref('RejectedResult'),ref('DeferredResult')]},50,1),'serverTime':ref('Instant')})
S['ChangeEnvelope'] = obj({'revision':ref('Revision'),'operationResults':arr(ref('Receipt'),50,1),'entities':arr(ref('Entity'),32)})
S['PullResponse'] = obj({'changes':arr(ref('ChangeEnvelope'),500),'nextCursor':ref('Opaque'),'hasMore':{'type':'boolean'},'highWaterRevision':ref('Revision'),'serverTime':ref('Instant')})
S['SnapshotManifest'] = obj({'snapshotId':ref('Id'),'highWaterRevision':ref('Revision'),'expiresAt':ref('Instant'),'entityCount':integer(),'firstPageCursor':ref('Opaque')})
S['SnapshotPage'] = obj({'snapshotId':ref('Id'),'highWaterRevision':ref('Revision'),'entities':arr(ref('Entity'),500),'nextPageCursor':nullable(ref('Opaque')),'complete':{'type':'boolean'},'pullCursor':nullable(ref('Opaque'))})
S['ReceiptsRequest'] = obj({'snapshotId':ref('Id'),'operationIds':arr(ref('Id'),50,1,True)})
S['ReceiptsResponse'] = obj({'snapshotId':ref('Id'),'highWaterRevision':ref('Revision'),'results':arr({'oneOf':[ref('Receipt'),ref('RejectedReceipt'),obj({'operationId':ref('Id'),'status':{'const':'notProcessedAtH'}})]},50,1)})
HTTP_CODES = ('invalid_request','invalid_credentials','email_unavailable','session_invalid','reset_invalid','rate_limited','unsupported_version','idempotency_key_conflict','payload_too_large','resync_required','snapshot_expired','temporarily_unavailable','resource_inaccessible')
S['ApiError'] = obj({'error':obj({'code':enum(*HTTP_CODES),'requestId':ref('Id'),'fields':arr(ref('FieldError'),50),'retryAfterSeconds':nullable(integer(1,300))})})
S['RegisterRequest'] = obj({'email':ref('Email'),'password':ref('Password'),'displayName':text(80),'deviceId':ref('Id')})
S['LoginRequest'] = obj({'email':ref('Email'),'password':ref('Password'),'deviceId':ref('Id')})
S['RefreshRequest'] = obj({'refreshToken':ref('Secret')})
S['RevokeRequest'] = obj({'revokeToken':ref('Secret')})
S['ResetRequest'] = obj({'email':ref('Email')})
S['ResetConfirmRequest'] = obj({'resetToken':ref('Secret'),'newPassword':ref('Password')})
S['SessionResponse'] = obj({'accountId':ref('Id'),'sessionId':ref('Id'),'accessToken':text(4096,32),'accessExpiresAt':ref('Instant'),'refreshToken':text(4096,32),'refreshExpiresAt':ref('Instant'),'revokeToken':text(4096,32),'profile':ref('AccountProfile')})
S['RefreshResponse'] = obj({k:v for k,v in S['SessionResponse']['properties'].items() if k != 'revokeToken'})
S['EmptyRequest'] = obj({})

def response(schema, description='Success'):
    return {'description':description, **({'content':{'application/json':{'schema':ref(schema)}}} if schema else {})}
def endpoint(operation_id, request, result, status='200', auth=True, errors=(), parameters=()):
    v={'operationId':operation_id,'security':[{'bearerAuth':[]}] if auth else [],'responses':{status:response(result)},'parameters':list(parameters)}
    if request: v['requestBody']={'required':True,'content':{'application/json':{'schema':ref(request)}}}
    for err in sorted(set(errors)|{400,413,429,503}|({401,426} if auth else set())):
        v['responses'][str(err)]=response('ApiError','Typed error; never include credentials or original payload.')
    return v
def param(name,loc,schema,required=True): return {'name':name,'in':loc,'required':required,'schema':schema}
paths={}
def add(path,method,*args,**kwargs): paths[path]={method:endpoint(*args,**kwargs)}
add('/auth/register','post','register','RegisterRequest','SessionResponse','201',False,(409,))
add('/auth/login','post','login','LoginRequest','SessionResponse',auth=False,errors=(401,))
add('/auth/refresh','post','refresh','RefreshRequest','RefreshResponse',auth=False,errors=(401,))
add('/auth/revoke','post','revoke','RevokeRequest',None,'204',False)
add('/auth/password-reset/request','post','requestReset','ResetRequest',None,'202',False)
add('/auth/password-reset/confirm','post','confirmReset','ResetConfirmRequest',None,'204',False,(401,))
add('/sync/push','post','push','PushRequest','PushResponse',errors=(409,),parameters=(param('Idempotency-Key','header',ref('Id')),))
add('/sync/pull','get','pull',None,'PullResponse',errors=(409,),parameters=(param('cursor','query',ref('Opaque'),False),))
add('/sync/snapshots','post','createSnapshot','EmptyRequest','SnapshotManifest','201')
add('/sync/snapshots/{snapshotId}','get','snapshotPage',None,'SnapshotPage',errors=(404,410),parameters=(param('snapshotId','path',ref('Id')),param('cursor','query',ref('Opaque'))))
add('/sync/receipts','post','receipts','ReceiptsRequest','ReceiptsResponse',errors=(404,410))
for pathitem in paths.values():
    for op in pathitem.values():
        op['parameters'].append(param('X-Ritmo-Protocol','header',{'type':'string','const':'m1.1'}))
        op['parameters'].append(param('X-App-Version','header',{**text(64),'pattern':'^[0-9]+\\.[0-9]+\\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$'}))
        op['responses'].setdefault('426',response('ApiError','Unsupported protocol/app version; preserve local data.'))
API={'openapi':'3.1.1','info':{'title':'Ritmo — primeiro marco','version':'0.1.0','description':'Executable transport specification. No live server. Semantics and invariants: README.md.'},'servers':[{'url':'/api/v1'}],'paths':paths,'components':{'securitySchemes':{'bearerAuth':{'type':'http','scheme':'bearer','bearerFormat':'JWT'}},'schemas':S}}

ID=lambda n: f'01996300-0000-7000-8000-{n:012d}'
TIME='2026-09-25T13:00:00Z'
TC={'timezone':'America/Sao_Paulo','dayStartHour':4}
PROFILE={'accountId':ID(1),'displayName':'Pessoa de teste','timeContext':TC,'plan':'free','onboardedAt':TIME,'analyticsConsentAt':None,'revision':'1'}
HABIT={'habitId':ID(3),'title':'Caminhar','habitType':'binary','scheduleKind':'daily','startDayKey':'2026-09-25','creationTimeContext':TC,'iconKey':None,'colorToken':None,'sortOrder':0,'createdAt':TIME,'updatedAt':TIME,'deletedAt':None,'revision':'2'}
DAY={'habitDayId':ID(4),'habitId':ID(3),'dayKey':'2026-09-25','done':True,'knownUndoIds':[],'revision':'3'}
GRANT={'grantId':ID(5),'habitDayId':ID(4),'amount':10,'dayKey':'2026-09-25','module':'habits','budgetCost':10,'active':True,'revision':'3'}
DECISION={'habitDayId':ID(4),'outcome':'granted','grantId':ID(5),'revision':'3'}
BUDGET={'dayKey':'2026-09-25','module':'habits','consumed':10,'dueHabitCount':1,'limit':150,'revision':'3'}
RECEIPT={'operationId':ID(10),'status':'accepted','acceptedRevision':'3'}
ENTITIES=[{'kind':k,'value':v} for k,v in [('habitDay',DAY),('xpGrant',GRANT),('xpDecision',DECISION),('xpBudget',BUDGET),('xpTransition',{'operationId':ID(10),'grantId':ID(5),'kind':'grant','acceptedAt':TIME,'revision':'3'})]]
OP={'operationId':ID(10),'deviceId':ID(2),'clientSequence':3,'occurredAt':TIME,'dependsOn':[],'command':{'type':'habit.mark','habitId':ID(3),'dayKey':'2026-09-25','timeContext':TC,'observedUndoIds':[]}}
SESSION={'accountId':ID(1),'sessionId':ID(6),'accessToken':'fixture.access.token.not.a.credential','accessExpiresAt':'2026-09-25T13:15:00Z','refreshToken':'fixture_refresh_token_not_a_credential','refreshExpiresAt':'2026-10-25T13:00:00Z','revokeToken':'fixture_revoke_token_not_a_credential','profile':PROFILE}
EX=[]
def example(name,schema,value,valid=True): EX.append({'name':name,'schema':schema,'valid':valid,'value':copy.deepcopy(value)})
example('register','RegisterRequest',{'email':'person@example.test','password':'fixture-password','displayName':'Pessoa de teste','deviceId':ID(2)})
example('login','LoginRequest',{'email':'person@example.test','password':'fixture-password','deviceId':ID(2)})
example('refresh','RefreshRequest',{'refreshToken':SESSION['refreshToken']})
example('revoke','RevokeRequest',{'revokeToken':SESSION['revokeToken']})
example('reset-request','ResetRequest',{'email':'person@example.test'})
example('reset-confirm','ResetConfirmRequest',{'resetToken':'fixture_reset_token_not_a_credential','newPassword':'changed-fixture-password'})
example('session','SessionResponse',SESSION)
example('refreshed-session','RefreshResponse',{k:v for k,v in SESSION.items() if k != 'revokeToken'})
example('push','PushRequest',{'operations':[OP]})
example('ack','PushResponse',{'results':[{'receipt':RECEIPT,'replayed':False,'projections':ENTITIES}],'serverTime':TIME})
example('retry','PushResponse',{'results':[{'receipt':RECEIPT,'replayed':True,'projections':ENTITIES}],'serverTime':TIME})
for code in ('title_unavailable','dependency_rejected','id_content_conflict'):
    example(code,'PushResponse',{'results':[{'receipt':{'operationId':ID(10),'status':'rejected','error':{'code':code,'fields':[],'dependencyIds':[ID(9)] if code=='dependency_rejected' else []}},'replayed':False}],'serverTime':TIME})
example('deferred','PushResponse',{'results':[{'operationId':ID(10),'status':'deferred','missingDependencyIds':[ID(9)]}],'serverTime':TIME})
example('pull','PullResponse',{'changes':[{'revision':'3','operationResults':[RECEIPT],'entities':ENTITIES}],'nextCursor':'fixture_cursor_after_3','hasMore':False,'highWaterRevision':'3','serverTime':TIME})
example('snapshot-request','EmptyRequest',{})
example('snapshot-manifest','SnapshotManifest',{'snapshotId':ID(20),'highWaterRevision':'3','expiresAt':'2026-09-25T13:15:00Z','entityCount':7,'firstPageCursor':'fixture_snapshot_page_0'})
example('snapshot-page','SnapshotPage',{'snapshotId':ID(20),'highWaterRevision':'3','entities':[{'kind':'profile','value':PROFILE},{'kind':'habit','value':HABIT}]+ENTITIES,'nextPageCursor':None,'complete':True,'pullCursor':'fixture_cursor_after_3'})
example('receipts-request','ReceiptsRequest',{'snapshotId':ID(20),'operationIds':[ID(10),ID(11)]})
example('receipts-response','ReceiptsResponse',{'snapshotId':ID(20),'highWaterRevision':'3','results':[RECEIPT,{'operationId':ID(11),'status':'notProcessedAtH'}]})
for code in HTTP_CODES:
    example(code,'ApiError',{'error':{'code':code,'requestId':ID(30),'fields':[],'retryAfterSeconds':2 if code in ('rate_limited','temporarily_unavailable') else None}})
for name,command in [('create',{'type':'habit.create','habitId':ID(3),'title':'Caminhar','habitType':'binary','scheduleKind':'daily','startDayKey':'2026-09-25','timeContext':TC,'iconKey':None,'colorToken':None,'sortOrder':0}),('patch',{'type':'habit.patchMetadata','habitId':ID(3),'patch':{'title':'Caminhada'}}),('unmark',{'type':'habit.unmark','habitId':ID(3),'dayKey':'2026-09-25','timeContext':TC}),('onboarding',{'type':'profile.setOnboarding','timeContext':TC,'completed':True,'analyticsConsent':False})]:
    op=copy.deepcopy(OP); op['command']=command; example(name,'Operation',op)
bad=copy.deepcopy(OP); bad['userId']=ID(99); example('reject-client-owner','Operation',bad,False)
bad=copy.deepcopy(OP); bad['command']['totalXp']=100; example('reject-client-xp','Operation',bad,False)
bad=copy.deepcopy(OP); bad['command']['dayKey']='2026-02-30'; example('reject-invalid-date','Operation',bad,False)
example('reject-numeric-revision','Revision',9007199254740993,False)
example('reject-empty-patch','MetadataPatch',{},False)
example('reject-empty-batch','PushRequest',{'operations':[]},False)
example('reject-large-batch','PushRequest',{'operations':[OP]*51},False)
bad=copy.deepcopy(OP); bad['command']['type']='xp.setTotal'; example('reject-unknown-command','Operation',bad,False)
example('reject-unknown-result','PushResponse',{'results':[{'status':'success'}],'serverTime':TIME},False)
example('reject-unsupported-habit','CreateHabitCommand',{'type':'habit.create','habitId':ID(3),'title':'Beber','habitType':'quantitative','scheduleKind':'daily','startDayKey':'2026-09-25','timeContext':TC,'iconKey':None,'colorToken':None,'sortOrder':0},False)
for name,data in [('openapi.json',API),('examples.json',EX)]:
    (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(S)} schemas, {len(paths)} endpoints, {len(EX)} fixtures.')
