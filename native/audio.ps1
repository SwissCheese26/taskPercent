# Persistenter Audio-Server: liest JSON-Zeilen von stdin, antwortet mit JSON-Zeilen auf stdout.
# Nutzt die Windows Core Audio API (MMDevice / IAudioEndpointVolume). Braucht KEINE Admin-Rechte.
$ErrorActionPreference = 'Stop'
$src = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
}
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int Item(int index, out IMMDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore store);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetState(out int state);
}
[StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public int pid; }
[StructLayout(LayoutKind.Explicit, Size = 24)] struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr p; }
[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetAt(int i, out PROPERTYKEY key);
    [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
    [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
    [PreserveSig] int Commit();
}
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    [PreserveSig] int RegisterControlChangeNotify(IntPtr n);
    [PreserveSig] int UnregisterControlChangeNotify(IntPtr n);
    [PreserveSig] int GetChannelCount(out int c);
    [PreserveSig] int SetMasterVolumeLevel(float db, ref Guid ctx);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
    [PreserveSig] int GetMasterVolumeLevel(out float db);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    [PreserveSig] int SetChannelVolumeLevel(uint ch, float db, ref Guid ctx);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint ch, float level, ref Guid ctx);
    [PreserveSig] int GetChannelVolumeLevel(uint ch, out float db);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint ch, out float level);
    [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
    [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
}

public class AudioDev { public string Id, Name, Flow; public int Volume; public bool Muted, IsDefault; }

public static class AudioApi {
    [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT pv);
    static IMMDeviceEnumerator Enum() { return (IMMDeviceEnumerator)new MMDeviceEnumeratorCom(); }
    static IAudioEndpointVolume Vol(IMMDevice d) {
        Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
        Marshal.ThrowExceptionForHR(d.Activate(ref iid, 23, IntPtr.Zero, out o));
        return (IAudioEndpointVolume)o;
    }
    static string Name(IMMDevice d) {
        IPropertyStore ps; Marshal.ThrowExceptionForHR(d.OpenPropertyStore(0, out ps));
        PROPERTYKEY k = new PROPERTYKEY { fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid = 14 };
        PROPVARIANT v; ps.GetValue(ref k, out v);
        string s = (v.vt == 31) ? Marshal.PtrToStringUni(v.p) : "Unbekannt";
        PropVariantClear(ref v); return s;
    }
    public static List<AudioDev> List() {
        var res = new List<AudioDev>(); var en = Enum();
        for (int flow = 0; flow < 2; flow++) {
            string defId = null; IMMDevice def;
            if (en.GetDefaultAudioEndpoint(flow, 1, out def) == 0) def.GetId(out defId);
            IMMDeviceCollection col; Marshal.ThrowExceptionForHR(en.EnumAudioEndpoints(flow, 1, out col));
            int n; col.GetCount(out n);
            for (int i = 0; i < n; i++) {
                IMMDevice d; col.Item(i, out d); string id; d.GetId(out id);
                var a = new AudioDev { Id = id, Name = Name(d), Flow = flow == 0 ? "render" : "capture", IsDefault = id == defId };
                try { var v = Vol(d); float lv; bool m; v.GetMasterVolumeLevelScalar(out lv); v.GetMute(out m); a.Volume = (int)Math.Round(lv * 100); a.Muted = m; } catch { a.Volume = -1; }
                res.Add(a);
            }
        }
        return res;
    }
    static IAudioEndpointVolume ById(string id) { IMMDevice d; Marshal.ThrowExceptionForHR(Enum().GetDevice(id, out d)); return Vol(d); }
    public static void SetVolume(string id, int pct) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(ById(id).SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, pct)) / 100f, ref g)); }
    public static void SetMute(string id, bool mute) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(ById(id).SetMute(mute, ref g)); }
}
'@
Add-Type -TypeDefinition $src
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

while (($line = [Console]::In.ReadLine()) -ne $null) {
    $req = $null
    try {
        $req = $line | ConvertFrom-Json
        $data = $null
        switch ($req.cmd) {
            'list'   { $data = @([AudioApi]::List()) }
            'volume' { [AudioApi]::SetVolume([string]$req.id, [int]$req.value) }
            'mute'   { [AudioApi]::SetMute([string]$req.id, [bool]$req.value) }
            default  { throw "Unbekannter Befehl: $($req.cmd)" }
        }
        $out = @{ rid = $req.rid; ok = $true; data = $data }
    } catch {
        $out = @{ rid = $(if ($req) { $req.rid } else { 0 }); ok = $false; error = $_.Exception.Message }
    }
    [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 5))
    [Console]::Out.Flush()
}
