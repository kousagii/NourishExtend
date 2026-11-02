const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {root,javaHome,sdkRoot,runBat}=require('./android-tools.cjs');
try{
  const java=javaHome(),sdk=sdkRoot();
  const required=['platforms/android-37.0/android.jar','build-tools/37.0.0/aapt2.exe','ndk/27.1.12297006/source.properties','cmake/3.22.1/bin/cmake.exe'];
  if(required.some(file=>!fs.existsSync(path.join(sdk,file))))throw new Error('Required Android SDK packages are missing. Run npm.cmd run android:setup first and review its licence prompts.');
  const privateDir=path.join(root,'.local');fs.mkdirSync(privateDir,{recursive:true});
  const keyfile=path.join(privateDir,'nourish-demo.keystore'),properties=path.join(privateDir,'demo-signing.properties');
  if(!fs.existsSync(keyfile)&&!fs.existsSync(properties)){
    const password=crypto.randomBytes(32).toString('base64url');
    const result=spawnSync(path.join(java,'bin','keytool.exe'),['-genkeypair','-keystore',keyfile,'-storepass:env','NOURISH_DEMO_KEY_PASSWORD','-keypass:env','NOURISH_DEMO_KEY_PASSWORD','-alias','nourish-demo','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=NourishExtend School Demo','-noprompt'],{stdio:'inherit',env:{...process.env,NOURISH_DEMO_KEY_PASSWORD:password}});
    if(result.status!==0)throw new Error('Demo signing key generation failed.');
    fs.writeFileSync(properties,'storeFile=nourish-demo.keystore\nstorePassword='+password+'\nkeyAlias=nourish-demo\nkeyPassword='+password+'\n',{mode:0o600,flag:'wx'});
  }else if(!fs.existsSync(keyfile)||!fs.existsSync(properties))throw new Error('Demo signing files are incomplete. Restore the matching private key and properties before rebuilding.');
  fs.writeFileSync(path.join(root,'android','local.properties'),'sdk.dir='+sdk.replace(/\\/g,'/').replace(/:/g,'\\:')+'\n');
  runBat(path.join(root,'android','gradlew.bat'),[':app:assembleDemo','--no-daemon','--max-workers=2'],{cwd:path.join(root,'android'),env:{...process.env,JAVA_HOME:java,ANDROID_HOME:sdk,GRADLE_USER_HOME:path.join(root,'.tools','gradle'),NODE_ENV:'production'}});
  const apk=path.join(root,'android','app','build','outputs','apk','demo','app-demo.apk');
  if(!fs.existsSync(apk))throw new Error('Gradle did not produce the expected APK.');
  fs.mkdirSync(path.join(root,'exports'),{recursive:true});fs.copyFileSync(apk,path.join(root,'exports','NourishExtend-demo.apk'));
  console.log('Built exports/NourishExtend-demo.apk. Keep .local signing files private and backed up.');
}catch(error){console.error(error.message);process.exitCode=1;}
