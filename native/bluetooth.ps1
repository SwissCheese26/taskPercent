# Persistenter Bluetooth-Listen-Server (nur lesen, keine Admin-Rechte noetig).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$connKey = '{83DA6326-97A6-4088-9453-A1923F573B29} 15'   # DEVPKEY_Device_IsConnected

function Get-BtDevices {
    $list = @()
    foreach ($d in (Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue)) {
        if ($d.InstanceId -notmatch '^(BTHENUM|BTHLE)\\DEV_') { continue }
        $p = Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName $connKey -ErrorAction SilentlyContinue
        $list += [pscustomobject]@{
            Name      = $d.FriendlyName
            Id        = $d.InstanceId
            Connected = [bool]($p -and $p.Data)
            Disabled  = ($d.Problem -eq 'CM_PROB_DISABLED' -or $d.ConfigManagerErrorCode -eq 22)
        }
    }
    return $list
}

while (($line = [Console]::In.ReadLine()) -ne $null) {
    $req = $null
    try {
        $req = $line | ConvertFrom-Json
        if ($req.cmd -ne 'list') { throw "Unbekannter Befehl: $($req.cmd)" }
        $out = @{ rid = $req.rid; ok = $true; data = @(Get-BtDevices) }
    } catch {
        $out = @{ rid = $(if ($req) { $req.rid } else { 0 }); ok = $false; error = $_.Exception.Message }
    }
    [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 5))
    [Console]::Out.Flush()
}
