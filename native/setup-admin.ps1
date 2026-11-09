# Wird EINMALIG erhoeht ausgefuehrt (UAC-Abfrage). Richtet den Admin-Helfer ein oder entfernt ihn.
param([string]$User, [string]$Source, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$base = Join-Path $env:ProgramData 'taskPercent'
$task = 'taskPercentHelper'

if ($Remove) {
    Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
    if (Test-Path $base) { Remove-Item -Recurse -Force $base }
    exit 0
}

New-Item -ItemType Directory -Force -Path $base, (Join-Path $base 'requests'), (Join-Path $base 'results') | Out-Null
Copy-Item -Force -Path $Source -Destination (Join-Path $base 'helper.ps1')

# Basisordner + Skript: Benutzer duerfen NUR lesen (sonst waere der erhoehte Helfer manipulierbar)
icacls $base /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
# requests/results: Benutzer duerfen Dateien anlegen/lesen (aber Skript bleibt geschuetzt)
foreach ($sub in 'requests', 'results') { icacls (Join-Path $base $sub) /grant '*S-1-5-32-545:(OI)(CI)M' | Out-Null }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $base 'helper.ps1') + '"')
$principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances Queue
Register-ScheduledTask -TaskName $task -Action $action -Principal $principal -Settings $settings -Force | Out-Null
