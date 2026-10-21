const {withMainActivity,withMainApplication,withDangerousMod}=require('expo/config-plugins');
const {mkdir,readFile,writeFile,rm}=require('node:fs/promises');
const {join}=require('node:path');
module.exports=(config,{enabled=false,detailed=false}={})=>{
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
 config=withMainApplication(config,mod=>{
  const anchor='PackageList(this).packages.apply {';
  if(!mod.modResults.contents.includes(anchor))throw new Error('performance_package_anchor_missing');
  mod.modResults.contents=mod.modResults.contents.replace(/\n\s*add\(RitmoPerformancePackage\(\)\)/g,'');
  if(detailed)mod.modResults.contents=mod.modResults.contents.replace(anchor,anchor+'\n          add(RitmoPerformancePackage())');
  return mod;
 });
 return withDangerousMod(config,['android',async mod=>{
  const pkg=config.android.package,folder=join(mod.modRequest.platformProjectRoot,'app/src/main/java',...pkg.split('.'));
  await mkdir(folder,{recursive:true});
  if(!detailed)await rm(join(folder,'RitmoPerformance.kt'),{force:true});
  for(const file of detailed?['RitmoFrameProbe.kt','RitmoPerformance.kt']:['RitmoFrameProbe.kt']) {
   const source=await readFile(join(__dirname,file),'utf8');
   await writeFile(join(folder,file),source.replace('RITMO_PACKAGE',pkg),'utf8');
  }
  return mod;
 }]);
};
