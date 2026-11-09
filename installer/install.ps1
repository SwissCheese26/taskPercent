<#
 taskPercent - Ein-Zeilen-Installer fuer Windows 10/11 (kein Administrator noetig).

 Installieren (PowerShell, normales Benutzerkonto):
   irm https://raw.githubusercontent.com/SwissCheese26/taskPercent/main/installer/install.ps1 | iex

 Was passiert:
   1. Laedt den Installer (taskPercent-Setup-<Version>.exe) des neuesten GitHub-Releases.
   2. Gibt es keinen Release-Installer und sind Node.js + npm vorhanden, wird er aus den Quellen gebaut.
   3. Installiert pro Benutzer nach %LOCALAPPDATA%\Programs\taskPercent und startet die App.

 Optionen (Umgebungsvariablen, vor dem Aufruf setzen):
   $env:TASKPERCENT_WIZARD = '1'   Installations-Assistent anzeigen statt stiller Installation
   $env:TASKPERCENT_FROM_SOURCE = '1'   Immer aus den Quellen bauen
   $env:TASKPERCENT_BRANCH = 'main'     Branch fuer den Quellbau
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$repo = 'SwissCheese26/taskPercent'
$work = Join-Path ([IO.Path]::GetTempPath()) ('taskPercent-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $work | Out-Null
$setup = $null

function Get-ReleaseInstaller {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'taskPercent-installer' }
    $asset = $rel.assets | Where-Object { $_.name -like 'taskPercent-Setup-*.exe' } | Select-Object -First 1
    if (-not $asset) { throw 'Kein Installer im neuesten Release.' }
    $dest = Join-Path $work $asset.name
    Write-Host "Lade $($asset.name) ..."
    Invoke-WebRequest $asset.browser_download_url -OutFile $dest
    return $dest
}

function Build-FromSource {
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw 'Node.js/npm nicht gefunden. Installiere Node.js (https://nodejs.org) oder warte auf einen Release.'
    }
    $branch = if ($env:TASKPERCENT_BRANCH) { $env:TASKPERCENT_BRANCH } else { 'main' }
    $zip = Join-Path $work 'src.zip'
    Write-Host "Lade Quellen ($branch) ..."
    Invoke-WebRequest "https://github.com/$repo/archive/refs/heads/$branch.zip" -OutFile $zip
    Expand-Archive $zip -DestinationPath $work
    $src = Get-ChildItem $work -Directory | Where-Object { $_.Name -like 'taskPercent-*' } | Select-Object -First 1
    Push-Location $src.FullName
    try {
        Write-Host 'Baue Installer (dauert einige Minuten) ...'
        & npm install --no-audit --no-fund; if ($LASTEXITCODE) { throw 'npm install fehlgeschlagen.' }
        & npm run dist; if ($LASTEXITCODE) { throw 'npm run dist fehlgeschlagen.' }
        $exe = Get-ChildItem (Join-Path $src.FullName 'dist') -Filter 'taskPercent-Setup-*.exe' | Select-Object -First 1
        if (-not $exe) { throw 'Installer wurde nicht erzeugt.' }
        return $exe.FullName
    } finally { Pop-Location }
}

try {
    if ($env:TASKPERCENT_FROM_SOURCE -ne '1') {
        try { $setup = Get-ReleaseInstaller } catch { Write-Host "Release nicht verfuegbar ($($_.Exception.Message)). Versuche Quellbau ..." }
    }
    if (-not $setup) { $setup = Build-FromSource }

    if ($env:TASKPERCENT_WIZARD -eq '1') {
        Start-Process $setup -Wait
    } else {
        Write-Host 'Installiere ...'
        Start-Process $setup -ArgumentList '/S' -Wait
        $exe = Join-Path $env:LOCALAPPDATA 'Programs\taskPercent\taskPercent.exe'
        if (Test-Path $exe) { Start-Process $exe }
    }
    Write-Host 'taskPercent ist installiert. Das Symbol erscheint im Tray (ggf. im ^-Ueberlauf).'
} finally {
    Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}
