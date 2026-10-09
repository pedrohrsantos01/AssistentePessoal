const {withAppBuildGradle}=require('@expo/config-plugins');
module.exports=config=>withAppBuildGradle(config,mod=>{
 const marker='// Ritmo: bundled font licenses';
 if(!mod.modResults.contents.includes(marker)) mod.modResults.contents+='\n'+marker+"\nandroid { sourceSets.main.assets.srcDirs += ['../../assets/licenses'] }\n";
 return mod;
});