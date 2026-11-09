# Persistenter Peripherie-Server: Maus, Tastatur, Controller, Headsets, sonstige Bluetooth-Geraete inkl. Akkustand.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$battKey = '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'   # Bluetooth-Akkustand in Prozent (falls vom Geraet gemeldet)
$skip = 'PS/2|Remote|Virtual|Root|Terminal|Hyper-V|Synaptics Pointing'

function Get-Kind($class, $name) {
    if ($name -match 'controller|gamepad|xbox|dualsense|dualshock|joy-?con') { return 'gamepad' }
    if ($name -match 'head(set|phone)|buds|airpods|wh-|wf-|earbud|kopfh') { return 'headset' }
    if ($class -eq 'Mouse' -or $name -match 'mouse|maus|trackpad|trackball') { return 'mouse' }
    if ($class -eq 'Keyboard' -or $name -match 'keyboard|tastatur') { return 'keyboard' }
    return 'other'
}
function Get-Peripherals {
    $seen = @{}; $list = @()
    foreach ($class in 'Mouse', 'Keyboard', 'Bluetooth', 'HIDClass') {
        foreach ($d in (Get-PnpDevice -Class $class -PresentOnly -ErrorAction SilentlyContinue)) {
            if ($d.Status -ne 'OK' -or -not $d.FriendlyName) { continue }
            if ($class -eq 'Bluetooth' -and $d.InstanceId -notmatch '^(BTHENUM|BTHLE)\\DEV_') { continue }
            if ($class -eq 'HIDClass' -and $d.FriendlyName -notmatch 'controller|gamepad|xbox|dualsense|dualshock') { continue }
            if ($d.FriendlyName -match $skip) { continue }
            $bus = if ($d.InstanceId -match '^(BTH|BTHENUM|BTHLE)') { 'Bluetooth' } elseif ($d.InstanceId -match '^USB|^HID\\VID') { 'USB' } else { 'Sonstige' }
            $kind = Get-Kind $class $d.FriendlyName
            $name = $d.FriendlyName -replace 'HID-konforme (.*)', '$1' -replace 'HID-compliant (.*)', '$1'
            $key = "$kind|$name"
            if ($seen.ContainsKey($key)) { continue }; $seen[$key] = $true
            $p = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName $battKey -ErrorAction SilentlyContinue
            $batt = if ($p -and $p.Data -ne $null -and $p.Type -ne 'Empty') { [int]$p.Data } else { $null }
            $list += [pscustomobject]@{ Id = $d.InstanceId; Name = $name; Kind = $kind; Bus = $bus; Battery = $batt }
        }
    }
    return $list
}
while (($line = [Console]::In.ReadLine()) -ne $null) {
    $req = $null
    try {
        $req = $line | ConvertFrom-Json
        if ($req.cmd -ne 'list') { throw "Unbekannter Befehl: $($req.cmd)" }
        $out = @{ rid = $req.rid; ok = $true; data = @(Get-Peripherals) }
    } catch {
        $out = @{ rid = $(if ($req) { $req.rid } else { 0 }); ok = $false; error = $_.Exception.Message }
    }
    [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 5))
    [Console]::Out.Flush()
}
