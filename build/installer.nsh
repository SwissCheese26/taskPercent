; Eigene NSIS-Anpassungen fuer den taskPercent-Installer (electron-builder, Assistent, per-User).
; Wird ueber package.json -> build.nsis.include eingebunden.

; --- Immer pro Benutzer installieren: keine Auswahlseite "Alle Benutzer", keine Admin-Abfrage ---
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; --- Abschlussseite: "taskPercent starten" (vorbelegt) und "Mit Windows starten" (optional) ---
!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  ; Gleicher Eintrag, den app.setLoginItemSettings({ openAtLogin: true }) in Electron anlegt:
  ; HKCU\...\Run, Wertname = Name der EXE ohne Endung.
  Function TpEnableAutostart
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_FILENAME}" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "taskPercent jetzt starten"
  !define MUI_FINISHPAGE_RUN_FUNCTION StartApp
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Mit Windows starten"
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION TpEnableAutostart
  !insertmacro MUI_PAGE_FINISH
!macroend

; --- Deinstallation: Autostart und optionalen Admin-Helfer entfernen ---
; Laeuft im Kontext des Benutzers (per-User-Deinstaller, ohne Admin-Rechte).
!macro customUnInstall
  ; Bei einem Update (alte Version wird still deinstalliert) nichts anfassen.
  ${if} ${isUpdated}
    Goto tpUnDone
  ${endIf}

  ; 1) Autostart-Eintrag (Installer-Checkbox und Einstellung in der App schreiben denselben Wert)
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APP_FILENAME}"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${APP_FILENAME}"

  ; 2) Geplante Aufgabe 'taskPercentHelper' + %ProgramData%\taskPercent: nur mit Administratorrechten
  ;    entfernbar (Aufgabe laeuft mit hoechsten Rechten, Ordner ist fuer Benutzer schreibgeschuetzt).
  nsExec::Exec 'schtasks.exe /query /tn "taskPercentHelper"'
  Pop $0
  ${if} $0 != 0
    Goto tpUnDone
  ${endIf}

  ${if} ${Silent}
    DetailPrint "Admin-Helfer (Aufgabe taskPercentHelper) bleibt bestehen: stille Deinstallation ohne Administratorrechte."
    Goto tpUnDone
  ${endIf}

  MessageBox MB_YESNO|MB_ICONQUESTION "Der optionale Admin-Helfer von taskPercent ist noch eingerichtet (geplante Aufgabe $\"taskPercentHelper$\" und Ordner %ProgramData%\taskPercent).$\r$\n$\r$\nJetzt entfernen? Windows fragt dafuer nach Administratorrechten." /SD IDNO IDYES tpUnRemoveHelper IDNO tpUnDone

  tpUnRemoveHelper:
  ExecShellWait "runas" "powershell.exe" '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\resources\app\native\setup-admin.ps1" -Remove' SW_HIDE

  nsExec::Exec 'schtasks.exe /query /tn "taskPercentHelper"'
  Pop $0
  ${if} $0 == 0
    MessageBox MB_OK|MB_ICONINFORMATION "Der Admin-Helfer wurde nicht entfernt (Abfrage abgebrochen).$\r$\nManuell: PowerShell als Administrator oeffnen und ausfuehren:$\r$\nUnregister-ScheduledTask taskPercentHelper -Confirm:$$false; Remove-Item -Recurse -Force $\"$$env:ProgramData\taskPercent$\"" /SD IDOK
  ${endIf}

  tpUnDone:
!macroend
