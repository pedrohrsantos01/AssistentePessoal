const {withMainActivity,withDangerousMod}=require('expo/config-plugins');
const {mkdir,readFile,writeFile}=require('node:fs/promises');
const {join}=require('node:path');
module.exports=(config,{enabled=false}={})=>{
 if(!enabled)return config;
 if(config.android?.package!=='dev.ritmo.readonlytest')throw new Error('isolated_performance_package_required');
 config=withMainActivity(config,mod=>{
  if(mod.modResults.language!=='kt')throw new Error('kotlin_activity_required');
  let source=mod.modResults.contents;
  if(source.includes('private var ritmoFrameProbe'))return mod;
  const anchor='    super.onCreate(null)';if(!source.includes(anchor))throw new Error('performance_activity_anchor_missing');
  source=source.replace('class MainActivity : ReactActivity() {','class MainActivity : ReactActivity() {\n  private var ritmoFrameProbe: RitmoFrameProbe? = null');
  source=source.replace(anchor,anchor+'\n    ritmoFrameProbe = RitmoFrameProbe(this)');
  source=source.replace('  override fun getMainComponentName()',`  override fun dispatchTouchEvent(event: android.view.MotionEvent): Boolean {
    ritmoFrameProbe?.onTouch(event)
    return super.dispatchTouchEvent(event)
  }
  override fun onDestroy() {
    ritmoFrameProbe?.close()
    super.onDestroy()
  }
  override fun getMainComponentName()`);
  mod.modResults.contents=source;return mod;
 });
 return withDangerousMod(config,['android',async mod=>{
  const pkg=config.android.package,folder=join(mod.modRequest.platformProjectRoot,'app/src/main/java',...pkg.split('.'));
  await mkdir(folder,{recursive:true});
  const source=await readFile(join(__dirname,'RitmoFrameProbe.kt'),'utf8');
  await writeFile(join(folder,'RitmoFrameProbe.kt'),source.replace('RITMO_PACKAGE',pkg),'utf8');return mod;
 }]);
};
