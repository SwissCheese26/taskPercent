# taskPercent Admin-Helfer. Laeuft NUR erhoeht ueber die geplante Aufgabe "taskPercentHelper".
# Fuehrt ausschliesslich eine feste Whitelist aus: Bluetooth-Geraet trennen / verbinden.
# Liegt in %ProgramData%\taskPercent (fuer normale Benutzer nur lesbar).
$ErrorActionPreference = 'Stop'
$base = Join-Path $env:ProgramData 'taskPercent'
$req  = Join-Path $base 'requests'
$res  = Join-Path $base 'results'

foreach ($f in Get-ChildItem -Path $req -Filter '*.json' -ErrorAction SilentlyContinue) {
    $id = $f.BaseName
    $out = @{ ok = $false; error = 'Ungueltige Anfrage' }
    try {
        if ($id -notmatch '^[0-9a-fA-F\-]{36}$') { throw 'Ungueltige Anfrage-ID' }
        $r = Get-Content -Raw -Path $f.FullName | ConvertFrom-Json
        if ($r.action -notin @('disconnect', 'connect')) { throw 'Aktion nicht erlaubt' }
        $inst = [string]$r.instanceId
        if ($inst.Length -gt 200 -or $inst -notmatch '^(BTHENUM|BTHLE)\\DEV_[A-Za-z0-9_&\\\{\}\-\.#]+$') { throw 'Geraet nicht erlaubt' }
        $dev = Get-PnpDevice -InstanceId $inst -ErrorAction Stop
        if ($dev.Class -ne 'Bluetooth') { throw 'Kein Bluetooth-Geraet' }
        if ($r.action -eq 'disconnect') { Disable-PnpDevice -InstanceId $inst -Confirm:$false }
        else                            { Enable-PnpDevice  -InstanceId $inst -Confirm:$false }
        $out = @{ ok = $true }
    } catch {
        $out = @{ ok = $false; error = $_.Exception.Message }
    }
    if ($id -match '^[0-9a-fA-F\-]{36}$') {
        ($out | ConvertTo-Json -Compress) | Set-Content -Path (Join-Path $res "$id.json") -Encoding UTF8
    }
    Remove-Item -Path $f.FullName -Force -ErrorAction SilentlyContinue
}
