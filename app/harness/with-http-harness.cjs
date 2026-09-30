const {withAndroidManifest,withDangerousMod}=require('expo/config-plugins');
const {mkdir,writeFile}=require('node:fs/promises');
const {join}=require('node:path');
// Only the explicit HTTP test variant permits unencrypted loopback requests.
module.exports=(config,{enabled})=>{
  const resource='@xml/ritmo_harness_network_security';
  config=withAndroidManifest(config,mod=>{
    const application=mod.modResults.manifest.application[0].$;
    if(enabled) application['android:networkSecurityConfig']=resource;
    else if(application['android:networkSecurityConfig']===resource) delete application['android:networkSecurityConfig'];
    return mod;
  });
  return withDangerousMod(config,['android',async mod=>{
    if(enabled) {
      const folder=join(mod.modRequest.platformProjectRoot,'app/src/main/res/xml');
      await mkdir(folder,{recursive:true});
      await writeFile(join(folder,'ritmo_harness_network_security.xml'),`<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">127.0.0.1</domain></domain-config>
</network-security-config>
`,'utf8');
    }
    return mod;
  }]);
};
