[Setup]
AppName=Nebula Smart Presence
AppVersion=1.0
DefaultDirName={pf}\NebulaPresence
DefaultGroupName=Nebula Smart Presence
UninstallDisplayIcon={app}\start_app.vbs
Compression=lzma2
SolidCompression=yes
OutputDir=Output
OutputBaseFilename=Setup_NebulaPresence
WizardStyle=modern
SetupIconFile=compiler:SetupClassicIcon.ico

[Files]
; Salin Node.exe Portabel
Source: "node.exe"; DestDir: "{app}"; Flags: ignoreversion

; Salin skrip VBS untuk start di background
Source: "start_app.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "stop_app.vbs"; DestDir: "{app}"; Flags: ignoreversion

; Salin Frontend
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

; Salin Backend (Termasuk node_modules yang sudah berisi sqlite3)
Source: "backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{commondesktop}\Nebula Smart Presence"; Filename: "{app}\start_app.vbs"; WorkingDir: "{app}"
Name: "{group}\Nebula Smart Presence"; Filename: "{app}\start_app.vbs"; WorkingDir: "{app}"
Name: "{group}\Stop Nebula Smart Presence"; Filename: "{app}\stop_app.vbs"; WorkingDir: "{app}"
Name: "{group}\Uninstall Nebula Smart Presence"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\start_app.vbs"; Description: "Jalankan Nebula Smart Presence"; Flags: nowait postinstall shellexec
