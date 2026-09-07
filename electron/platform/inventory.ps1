param([string]$FoldersJson = '[]')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$warnings = New-Object System.Collections.Generic.List[string]
$shortcuts = New-Object System.Collections.Generic.List[object]
$ws = New-Object -ComObject WScript.Shell
$shellApp = New-Object -ComObject Shell.Application
if ($env:ORBIT_SCAN_FOLDERS) { $FoldersJson=$env:ORBIT_SCAN_FOLDERS }
$folders = @($FoldersJson | ConvertFrom-Json)
foreach ($folder in $folders) {
  if (!(Test-Path -LiteralPath $folder)) { $warnings.Add("No se encuentra la carpeta: $folder"); continue }
  # Two levels of shortcut folders; do not traverse game data or emulator trees.
  $dirs = @($folder) + @(Get-ChildItem -LiteralPath $folder -Directory -ErrorAction SilentlyContinue | Where-Object { !($_.Attributes -band [IO.FileAttributes]::ReparsePoint) } | Select-Object -ExpandProperty FullName)
  foreach ($dir in $dirs) {
    $namespace = $shellApp.NameSpace($dir)
    foreach ($file in @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.lnk','.url' })) {
      try {
        $target=''; $arguments=''; $parsing=''; $url=''
        if ($file.Extension -eq '.lnk') {
          $shortcut = $ws.CreateShortcut($file.FullName)
          $target=$shortcut.TargetPath; $arguments=$shortcut.Arguments
          $item=$namespace.ParseName($file.Name)
          $parsing=[string]$item.ExtendedProperty('System.Link.TargetParsingPath')
        } else {
          $url=[string]((Get-Content -LiteralPath $file.FullName | Where-Object { $_ -match '^URL=' } | Select-Object -First 1) -replace '^URL=','')
        }
        $shortcuts.Add([pscustomobject]@{name=$file.BaseName;path=$file.FullName;target=$target;arguments=$arguments;parsing=$parsing;url=$url})
      } catch { $warnings.Add("No se pudo leer el acceso: $($file.Name)") }
    }
  }
}
$steamPath = ''
try { $steamPath=(Get-ItemProperty 'HKCU:\Software\Valve\Steam').SteamPath } catch {}
$uninstall = @()
foreach ($key in @('HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')) {
  if (Test-Path $key) {
    $uninstall += @(Get-ChildItem $key -ErrorAction SilentlyContinue | Get-ItemProperty -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and ($_.Publisher -match 'Electronic Arts|Ubisoft|Rockstar|GOG.com|Blizzard' -or $_.PSChildName -match '^Steam App|^Uplay Install|_is1$') } | Select-Object DisplayName,InstallLocation,DisplayIcon,Publisher,PSChildName)
  }
}
$packages = @(); $packageScanOk = $true
try { $packages=@(Get-AppxPackage -ErrorAction Stop | Where-Object { !$_.IsFramework -and !$_.IsResourcePackage } | Select-Object Name,PackageFamilyName,InstallLocation) } catch { $packageScanOk=$false; $warnings.Add('Windows no pudo consultar los paquetes de Xbox.') }
$startApps=@()
try { $startApps=@(Get-StartApps | Select-Object Name,AppID) } catch {}
$ubisoft=@()
if (Test-Path 'HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs') {
  $ubisoft=@(Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\Ubisoft\Launcher\Installs' | ForEach-Object { $p=Get-ItemProperty $_.PSPath; [pscustomobject]@{id=$_.PSChildName;path=$p.InstallDir} })
}
$drives=@(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Z]:\\$' } | Select-Object -ExpandProperty Root)
[pscustomobject]@{shortcuts=$shortcuts.ToArray();steamPath=$steamPath;uninstall=$uninstall;packages=$packages;packageScanOk=$packageScanOk;startApps=$startApps;ubisoft=$ubisoft;drives=$drives;warnings=$warnings.ToArray()} | ConvertTo-Json -Depth 8 -Compress
