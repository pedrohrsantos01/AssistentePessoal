from pathlib import Path
from zipfile import ZipFile
import json,re,hashlib,struct,argparse
parser=argparse.ArgumentParser()
parser.add_argument("--output",default=".scratch/runtime/interface/bundle-audit.json")
args=parser.parse_args()
apk=Path('app/android/app/build/outputs/apk/release/app-release.apk')
selected=[]
for module in re.findall(r"from '([^']+)'",Path('app/src/theme/fonts.ts').read_text(encoding='utf-8')):
 files=list((Path('app/node_modules')/module).glob('*.ttf'));assert len(files)==1,module
 selected.append((files[0].name,hashlib.sha256(files[0].read_bytes()).hexdigest()))
def family(blob):
 count=struct.unpack_from('>H',blob,4)[0]
 for i in range(count):
  if blob[12+16*i:16+16*i]==b'name':
   offset=struct.unpack_from('>I',blob,20+16*i)[0]
   _,n,start=struct.unpack_from('>HHH',blob,offset)
   for j in range(n):
    platform,_,_,name_id,length,relative=struct.unpack_from('>HHHHHH',blob,offset+6+12*j)
    if name_id==1:
     return blob[offset+start+relative:offset+start+relative+length].decode('utf-16-be' if platform in (0,3) else 'latin-1')
 return 'unknown'
with ZipFile(apk) as z:
 fonts=[name for name in z.namelist() if name.lower().endswith('.ttf')]
 by_hash={hashlib.sha256(z.read(name)).hexdigest():name for name in fonts}
 assert len(selected)==11
 assert all(digest in by_hash for _,digest in selected)
 licenses=[name for name in z.namelist() if name.endswith('-OFL.txt')];assert len(licenses)==3,licenses
 for name in licenses:assert b'SIL OPEN FONT LICENSE' in z.read(name),name
 unicodeLicense=[name for name in z.namelist() if name.endswith('unicode-3.0.txt')];assert len(unicodeLicense)==1
 assert z.read(unicodeLicense[0])==Path('app/assets/licenses/unicode-3.0.txt').read_bytes()
 result={'unicodeLicense':unicodeLicense[0],'unicodeLicenseSha256':hashlib.sha256(z.read(unicodeLicense[0])).hexdigest(),'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'selectedWeights':[{ 'source':name,'asset':by_hash[digest],'sha256':digest }for name,digest in selected],'totalTtfFiles':len(fonts),'additionalFontFamilies':[family(z.read(name)) for name in fonts if hashlib.sha256(z.read(name)).hexdigest() not in dict(selected).values()],'oflFiles':licenses,'passed':True}
output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'selectedWeights':len(selected),'totalTtfFiles':len(fonts),'additional':result['additionalFontFamilies'],'oflFiles':licenses,'passed':True},ensure_ascii=False))