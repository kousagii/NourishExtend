const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function unityPlayers(){
  const directory='C:/Program Files/Unity/Hub/Editor';
  return fs.existsSync(directory)?fs.readdirSync(directory).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})).map(version=>path.join(directory,version,'Editor/Data/PlaybackEngines/AndroidPlayer')):[];
}
function javaHome(){
  const choices=[process.env.JAVA_HOME,...unityPlayers().map(folder=>path.join(folder,'OpenJDK'))].filter(Boolean);
  const found=choices.find(folder=>fs.existsSync(path.join(folder,'bin','java.exe')));
  if(!found)throw new Error('Install JDK 17 and set JAVA_HOME, or install Android Studio and configure a compatible JDK.');
  return found;
}
function sdkRoot(){return process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||path.join(root,'.tools','android-sdk');}
function sdkManager(){
  const candidates=[sdkRoot(),...unityPlayers().map(folder=>path.join(folder,'SDK'))];
  for(const candidate of candidates){
    const directory=path.join(candidate,'cmdline-tools');if(!fs.existsSync(directory))continue;
    for(const version of fs.readdirSync(directory).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))){
      const file=path.join(directory,version,'bin','sdkmanager.bat');if(fs.existsSync(file))return file;
    }
  }
  throw new Error('Install Android SDK Command-line Tools through Android Studio, then set ANDROID_HOME.');
}
function runBat(file,args,options={}){
  const parts=[file,...args];
  if(parts.some(value=>/["\r\n&|<>^%!]/.test(value)))throw new Error('Use an Android SDK/project path without command-shell special characters.');
  const command='"'+parts.map(value=>'"'+value+'"').join(' ')+'"';
  const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command],{stdio:'inherit',windowsVerbatimArguments:true,...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Android tool exited with code '+result.status+'. Review the output above.');
}
module.exports={root,javaHome,sdkRoot,sdkManager,runBat};
