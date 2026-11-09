<#
  taskPercent - Akku-Prozente direkt im Windows-11-Infobereich (Taskleiste)

  * Zeigt den Ladestand als Zahl im Tray-Icon (farbig: normal / gelb / rot / gruen beim Laden)
  * Unter 15 % (nicht am Netzteil): blinkendes rotes Icon, Windows-Benachrichtigung
    und ein auffaelliges Warnfenster unten rechts
  * Rechtsklick auf das Icon: Autostart an/aus, Beenden
  * Keine Installation noetig, keine Zusatzpakete - laeuft mit Windows PowerShell 5.1
#>

$ErrorActionPreference = 'Stop'

$WarnThreshold   = 15   # Warnung unterhalb von (<=) diesem Wert
$YellowThreshold = 30   # Icon wird gelb
$RearmAbove      = 20   # Warnung wird erst wieder "scharf", wenn der Akku darueber liegt
$PollSeconds     = 20

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Nur eine Instanz gleichzeitig
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\taskPercent_BatteryTray', [ref]$createdNew)
if (-not $createdNew) { exit }

Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public static class NativeIcon {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool DestroyIcon(IntPtr hIcon);
}

// Fenster, das erscheint ohne den Fokus zu stehlen
public class ToastForm : Form {
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams {
        get {
            CreateParams cp = base.CreateParams;
            cp.ExStyle |= 0x08000000; // WS_EX_NOACTIVATE
            cp.ExStyle |= 0x00000080; // WS_EX_TOOLWINDOW (nicht in Alt+Tab)
            return cp;
        }
    }
}
'@

# ---------------------------------------------------------------- Icon zeichnen
function New-BatteryIcon {
    param([string]$Text, [System.Drawing.Color]$Back, [System.Drawing.Color]$Fore)

    $size = 32
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = 'AntiAlias'
        $g.TextRenderingHint = 'AntiAliasGridFit'
        $g.Clear([System.Drawing.Color]::Transparent)

        # abgerundetes Rechteck
        $r = 8
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, $r, $r, 180, 90)
        $path.AddArc($size - $r - 1, 0, $r, $r, 270, 90)
        $path.AddArc($size - $r - 1, $size - $r - 1, $r, $r, 0, 90)
        $path.AddArc(0, $size - $r - 1, $r, $r, 90, 90)
        $path.CloseFigure()
        $brush = New-Object System.Drawing.SolidBrush($Back)
        $g.FillPath($brush, $path)

        $px = if ($Text.Length -ge 3) { 18 } elseif ($Text.Length -eq 2) { 24 } else { 26 }
        $font = New-Object System.Drawing.Font('Segoe UI', $px, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $fmt = New-Object System.Drawing.StringFormat
        $fmt.Alignment = 'Center'
        $fmt.LineAlignment = 'Center'
        $rect = New-Object System.Drawing.RectangleF(0, 1, $size, $size)
        $fg = New-Object System.Drawing.SolidBrush($Fore)
        $g.DrawString($Text, $font, $fg, $rect, $fmt)

        $h = $bmp.GetHicon()
        $tmp = [System.Drawing.Icon]::FromHandle($h)
        $icon = $tmp.Clone()
        $tmp.Dispose()
        [NativeIcon]::DestroyIcon($h) | Out-Null
        return $icon
    }
    finally {
        $g.Dispose(); $bmp.Dispose()
    }
}

function RGB($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

# ---------------------------------------------------------------- Akku lesen
function Get-Battery {
    $ps = [System.Windows.Forms.SystemInformation]::PowerStatus
    $hasBattery = -not ($ps.BatteryChargeStatus -band [System.Windows.Forms.BatteryChargeStatus]::NoSystemBattery)
    $pct = [int][math]::Round($ps.BatteryLifePercent * 100)
    if ($pct -gt 100) { $pct = 100 }
    [pscustomobject]@{
        HasBattery = $hasBattery
        Percent    = $pct
        Plugged    = ($ps.PowerLineStatus -eq [System.Windows.Forms.PowerLineStatus]::Online)
        Charging   = [bool]($ps.BatteryChargeStatus -band [System.Windows.Forms.BatteryChargeStatus]::Charging)
        Seconds    = $ps.BatteryLifeRemaining
    }
}

# ---------------------------------------------------------------- Warnfenster
$script:toast = $null
function Show-WarningToast {
    param([int]$Percent)

    if ($script:toast -and -not $script:toast.IsDisposed) { $script:toast.Close() }

    $f = New-Object ToastForm
    $f.FormBorderStyle = 'None'
    $f.StartPosition = 'Manual'
    $f.ShowInTaskbar = $false
    $f.TopMost = $true
    $f.Size = New-Object System.Drawing.Size(360, 104)
    $f.BackColor = RGB '#1F1F24'
    $f.Cursor = [System.Windows.Forms.Cursors]::Hand
    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $f.Location = New-Object System.Drawing.Point(($wa.Right - $f.Width - 16), ($wa.Bottom - $f.Height - 16))

    $red = RGB '#EF4444'
    $greyC = RGB '#A1A1AA'
    $trackC = RGB '#3F3F46'
    $f.Add_Paint({
        param($s, $e)
        $g = $e.Graphics
        $g.SmoothingMode = 'AntiAlias'
        $g.TextRenderingHint = 'ClearTypeGridFit'
        $b = New-Object System.Drawing.SolidBrush($red)
        $g.FillRectangle($b, 0, 0, 8, $s.Height)
        $b.Dispose()

        # grosse Prozentzahl
        $big = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $w = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.DrawString(('{0}%' -f $s.Tag), $big, $w, 22, 20)

        $t = New-Object System.Drawing.Font('Segoe UI Semibold', 16, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $g.DrawString('Akku fast leer', $t, (New-Object System.Drawing.SolidBrush($red)), 150, 22)
        $sm = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $grey = New-Object System.Drawing.SolidBrush($greyC)
        $g.DrawString("Bitte Netzteil anschliessen.", $sm, $grey, 150, 46)

        # Akku-Balken
        $bx = 22; $by = 76; $bw = 316; $bh = 10
        $track = New-Object System.Drawing.SolidBrush($trackC)
        $g.FillRectangle($track, $bx, $by, $bw, $bh)
        $fillW = [math]::Max(4, [int]($bw * [int]$s.Tag / 100))
        $g.FillRectangle((New-Object System.Drawing.SolidBrush($red)), $bx, $by, $fillW, $bh)
    }.GetNewClosure())
    $f.Tag = $Percent

    $f.Add_Click({ $this.Close() })
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 12000
    $timer.Add_Tick({ $timer.Stop(); if (-not $f.IsDisposed) { $f.Close() } }.GetNewClosure())
    $f.Add_FormClosed({ $timer.Stop(); $timer.Dispose() }.GetNewClosure())

    $script:toast = $f
    $f.Show()
    $timer.Start()
}

# ---------------------------------------------------------------- Tray
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Visible = $true

$script:warned      = $false
$script:blinkOn     = $false
$script:lowActive   = $false
$script:iconNormal  = $null
$script:iconAlt     = $null
$script:lastKey     = ''

function Set-TrayIcon($icon) {
    $old = $notify.Icon
    $notify.Icon = $icon
    if ($old -and -not [object]::ReferenceEquals($old, $script:iconNormal) -and -not [object]::ReferenceEquals($old, $script:iconAlt)) { $old.Dispose() }
}

function Update-Battery {
    $b = Get-Battery

    if (-not $b.HasBattery) {
        $key = 'none'
        if ($script:lastKey -ne $key) {
            $script:lastKey = $key
            $script:lowActive = $false
            $i = New-BatteryIcon '--' (RGB '#52525B') ([System.Drawing.Color]::White)
            $script:iconNormal = $i; $script:iconAlt = $null
            $notify.Icon = $i
        }
        $notify.Text = 'Kein Akku erkannt (Netzbetrieb)'
        $blink.Stop()
        return
    }

    $p = $b.Percent
    $low = ($p -le $WarnThreshold) -and (-not $b.Plugged)
    $text = "$p"

    if ($b.Plugged)           { $back = RGB '#16A34A'; $fore = [System.Drawing.Color]::White }
    elseif ($p -le $WarnThreshold)   { $back = RGB '#DC2626'; $fore = [System.Drawing.Color]::White }
    elseif ($p -le $YellowThreshold) { $back = RGB '#F59E0B'; $fore = RGB '#111827' }
    else                      { $back = RGB '#1F2937'; $fore = [System.Drawing.Color]::White }

    $key = "$text|$($back.ToArgb())"
    if ($key -ne $script:lastKey) {
        $script:lastKey = $key
        $old1 = $script:iconNormal; $old2 = $script:iconAlt
        $script:iconNormal = New-BatteryIcon $text $back $fore
        # Blink-Variante: hell/rot invertiert
        $script:iconAlt = if ($low) { New-BatteryIcon $text ([System.Drawing.Color]::White) (RGB '#DC2626') } else { $null }
        $script:blinkOn = $false
        $notify.Icon = $script:iconNormal
        if ($old1) { $old1.Dispose() }
        if ($old2) { $old2.Dispose() }
    }

    # Tooltip (max. 63 Zeichen)
    $state = if ($b.Plugged) { if ($p -ge 100) { 'voll' } else { 'wird geladen' } } else { 'Akkubetrieb' }
    $tip = "Akku $p% - $state"
    if (-not $b.Plugged -and $b.Seconds -gt 0) {
        $tip += (' - noch {0}:{1:00} h' -f [int][math]::Floor($b.Seconds / 3600), [int][math]::Floor(($b.Seconds % 3600) / 60))
    }
    if ($tip.Length -gt 63) { $tip = $tip.Substring(0, 63) }
    $notify.Text = $tip

    # Warnung
    if ($low) {
        $script:lowActive = $true
        if (-not $blink.Enabled) { $blink.Start() }
        if (-not $script:warned) {
            $script:warned = $true
            $notify.BalloonTipIcon = 'Warning'
            $notify.BalloonTipTitle = "Akku nur noch $p%"
            $notify.BalloonTipText = 'Bitte jetzt das Netzteil anschliessen.'
            $notify.ShowBalloonTip(8000)
            Show-WarningToast $p
        }
    }
    else {
        $script:lowActive = $false
        $blink.Stop()
        if ($script:iconNormal) { $notify.Icon = $script:iconNormal }
        if ($b.Plugged -or $p -gt $RearmAbove) { $script:warned = $false }
    }
}

# Blinken im Low-Zustand
$blink = New-Object System.Windows.Forms.Timer
$blink.Interval = 700
$blink.Add_Tick({
    if ($script:lowActive -and $script:iconAlt) {
        $script:blinkOn = -not $script:blinkOn
        $notify.Icon = if ($script:blinkOn) { $script:iconAlt } else { $script:iconNormal }
    }
})

# ---------------------------------------------------------------- Kontextmenue
$startupLink = Join-Path ([Environment]::GetFolderPath('Startup')) 'taskPercent.lnk'
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$miAuto = New-Object System.Windows.Forms.ToolStripMenuItem('Mit Windows starten')
$miAuto.Checked = Test-Path $startupLink
$miAuto.Add_Click({
    if (Test-Path $startupLink) {
        Remove-Item $startupLink -Force
    } else {
        $ws = New-Object -ComObject WScript.Shell
        $lnk = $ws.CreateShortcut($startupLink)
        $lnk.TargetPath = (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe')
        $lnk.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
        $lnk.WorkingDirectory = Split-Path $PSCommandPath
        $lnk.WindowStyle = 7
        $lnk.Save()
    }
    $miAuto.Checked = Test-Path $startupLink
})
$miTest = New-Object System.Windows.Forms.ToolStripMenuItem('Warnung testen')
$miTest.Add_Click({ Show-WarningToast 14 })
$miExit = New-Object System.Windows.Forms.ToolStripMenuItem('Beenden')
$miExit.Add_Click({
    $blink.Stop(); $poll.Stop()
    $notify.Visible = $false
    $notify.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
[void]$menu.Items.AddRange(@($miAuto, $miTest, (New-Object System.Windows.Forms.ToolStripSeparator), $miExit))
$notify.ContextMenuStrip = $menu

# ---------------------------------------------------------------- Start
$poll = New-Object System.Windows.Forms.Timer
$poll.Interval = $PollSeconds * 1000
$poll.Add_Tick({ Update-Battery })

# sofort aktualisieren, wenn Netzteil ein-/ausgesteckt wird
[Microsoft.Win32.SystemEvents]::add_PowerModeChanged({ Update-Battery })

Update-Battery
$poll.Start()
[System.Windows.Forms.Application]::Run()

$mutex.ReleaseMutex()
