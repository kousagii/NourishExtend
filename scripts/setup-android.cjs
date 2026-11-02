const fs=require('node:fs');
const {javaHome,sdkRoot,sdkManager,runBat}=require('./android-tools.cjs');
try{
  const java=javaHome(),sdk=sdkRoot(),manager=sdkManager();
  fs.mkdirSync(sdk,{recursive:true});
  console.log('Using existing Java and Android command-line tools. SDK packages will be installed in: '+sdk);
  console.log('Review any Google Android SDK licence prompts yourself. The script does not auto-accept them.');
  runBat(manager,['--sdk_root='+sdk,'platform-tools','platforms;android-37.0','build-tools;37.0.0','ndk;27.1.12297006','cmake;3.22.1'],{env:{...process.env,JAVA_HOME:java}});
  console.log('Android SDK setup completed. You can now run npm.cmd run build:apk.');
}catch(error){console.error(error.message);process.exitCode=1;}
