param([string]$Action,[string]$ConfigPath,[string]$PayloadPath)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
$c=Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$programs=[Environment]::GetFolderPath('Programs')
if(-not $programs){$programs=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'}
$shortcut=Join-Path $programs ($c.appId+'.lnk')
$protocolKey='HKCU:\Software\Classes\'+$c.protocol
$appKey='HKCU:\Software\Classes\AppUserModelId\'+$c.appId
function Register-Identity {
 New-Item -ItemType Directory -Path $programs -Force | Out-Null
 New-Item -Path $protocolKey -Force | Out-Null
 Set-Item -Path $protocolKey -Value 'URL:PROJECT DESK'
 New-ItemProperty -Path $protocolKey -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
 New-Item -Path ($protocolKey+'\shell\open\command') -Force | Out-Null
 $command='"'+$c.wscript+'" "'+$c.openVbs+'" "'+$c.node+'" "'+$c.openScript+'" "'+$c.data+'" "'+$c.port+'" "%1"'
 Set-Item -Path ($protocolKey+'\shell\open\command') -Value $command
 New-Item -Path $appKey -Force | Out-Null
 New-ItemProperty -Path $appKey -Name DisplayName -Value 'PROJECT DESK' -PropertyType String -Force | Out-Null
 $ws=New-Object -ComObject WScript.Shell
 $link=$ws.CreateShortcut($shortcut);$link.TargetPath=$c.wscript
 $link.Arguments='"'+$c.openVbs+'" "'+$c.node+'" "'+$c.openScript+'" "'+$c.data+'" "'+$c.port+'"'
 $link.Description='PROJECT DESK reminders';$link.Save()
 Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)] public struct PDKey {public Guid fmt;public uint pid;}
[StructLayout(LayoutKind.Explicit)] public struct PDValue {[FieldOffset(0)]public ushort vt;[FieldOffset(8)]public IntPtr text;}
[ComImport,Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface PDStore {
 void GetCount(out uint n);void GetAt(uint i,out PDKey k);void GetValue(ref PDKey k,out PDValue v);void SetValue(ref PDKey k,ref PDValue v);void Commit();}
public class PDShortcut {
 [DllImport("shell32.dll",CharSet=CharSet.Unicode,PreserveSig=false)]static extern void SHGetPropertyStoreFromParsingName(string p,IntPtr z,uint flags,ref Guid iid,out PDStore store);
 public static void Set(string path,string id){PDStore s;Guid iid=new Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");SHGetPropertyStoreFromParsingName(path,IntPtr.Zero,2,ref iid,out s);PDKey k=new PDKey{fmt=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),pid=5};PDValue v=new PDValue{vt=31,text=Marshal.StringToCoTaskMemUni(id)};try{s.SetValue(ref k,ref v);s.Commit();}finally{Marshal.FreeCoTaskMem(v.text);Marshal.ReleaseComObject(s);}}
}
'@
 [PDShortcut]::Set($shortcut,$c.appId)
}
switch($Action){
 'install' {
  Register-Identity
  $args='"'+$c.taskVbs+'" "'+$c.node+'" "'+$c.checker+'" "'+$c.data+'"'
  $a=New-ScheduledTaskAction -Execute $c.wscript -Argument $args -WorkingDirectory $c.root
  $daily=New-ScheduledTaskTrigger -Daily -At $c.dailyTime
  $login=New-ScheduledTaskTrigger -AtLogOn -User $identity
  $s=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  $p=New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $c.taskName -Action $a -Trigger @($daily,$login) -Settings $s -Principal $p -Description ('PROJECT DESK '+$c.data) -Force | Out-Null
  @{installed=$true;taskName=$c.taskName} | ConvertTo-Json -Compress
 }
 'uninstall' {
  try{[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null;[Windows.UI.Notifications.ToastNotificationManager]::History.Clear($c.appId)}catch{}
  $task=Get-ScheduledTask -TaskName $c.taskName -ErrorAction SilentlyContinue
  if($task){Unregister-ScheduledTask -TaskName $c.taskName -Confirm:$false}
  if(Test-Path -LiteralPath $shortcut){Remove-Item -LiteralPath $shortcut -Force}
  if(Test-Path -LiteralPath $protocolKey){Remove-Item -LiteralPath $protocolKey -Recurse -Force}
  if(Test-Path -LiteralPath $appKey){Remove-Item -LiteralPath $appKey -Recurse -Force}
  @{installed=$false;taskName=$c.taskName} | ConvertTo-Json -Compress
 }
 'status' {
  $t=Get-ScheduledTask -TaskName $c.taskName -ErrorAction SilentlyContinue
  if($t){$i=Get-ScheduledTaskInfo -TaskName $c.taskName;@{installed=$true;state=[string]$t.State;taskName=$c.taskName;lastResult=$i.LastTaskResult;lastRun=[string]$i.LastRunTime;nextRun=[string]$i.NextRunTime;startWhenAvailable=$t.Settings.StartWhenAvailable;triggers=$t.Triggers.Count} | ConvertTo-Json -Compress}
  else{@{installed=$false;taskName=$c.taskName} | ConvertTo-Json -Compress}
 }
 'run' {Start-ScheduledTask -TaskName $c.taskName;@{started=$true}|ConvertTo-Json -Compress}
 'toast' {
  [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
  [Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime] | Out-Null
  $xml=New-Object Windows.Data.Xml.Dom.XmlDocument
  $xml.LoadXml([IO.File]::ReadAllText($PayloadPath,[Text.Encoding]::UTF8))
  $toast=[Windows.UI.Notifications.ToastNotification]::new($xml);$toast.Tag='review';$toast.Group=$c.appId
  $notifier=[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($c.appId)
  $setting=[int]$notifier.Setting
  if($setting -ne 0){$reason=@('Enabled','DisabledForApplication','DisabledForUser','DisabledByGroupPolicy','DisabledByManifest')[$setting];throw ('Windows notification setting: '+$reason)}
  $notifier.Show($toast)
  $history=[Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory($c.appId)
  @{submitted=$true;setting='Enabled';historyCount=$history.Count}|ConvertTo-Json -Compress
 }
 default {throw 'Unsupported reminder command'}
}
