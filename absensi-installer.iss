[Setup]
AppName=Aplikasi Absensi Nabastala
AppVersion=1.0
DefaultDirName={pf}\AbsensiNabastala
DefaultGroupName=Absensi Nabastala
OutputDir=installer_output
OutputBaseFilename=AbsensiSetup_v1.0
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Files]
; 1. Masukkan file executable Backend (hasil dari pkg)
Source: "backend\dist\backend.exe"; DestDir: "{app}"; Flags: ignoreversion
; 2. Masukkan folder public / dist Frontend (React)
; Karena backend di-build untuk melayani frontend statis, pastikan backend Anda menyajikan folder 'dist' 
Source: "dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
; 3. Masukkan NSSM (Non-Sucking Service Manager) untuk background service
Source: "nssm.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Aplikasi Absensi Nabastala"; Filename: "http://localhost:5000"; IconFilename: "{app}\icon.ico"
Name: "{commondesktop}\Aplikasi Absensi"; Filename: "http://localhost:5000"; IconFilename: "{app}\icon.ico"
Name: "{group}\Uninstall Aplikasi Absensi"; Filename: "{uninstallexe}"

[Run]
; Menggunakan NSSM untuk menginstal backend sebagai Windows Service
Filename: "{app}\nssm.exe"; Parameters: "install AbsensiBackend ""{app}\backend.exe"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "set AbsensiBackend AppDirectory ""{app}"""; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "start AbsensiBackend"; Flags: runhidden

[UninstallRun]
; Hentikan dan hapus service saat uninstall
Filename: "{app}\nssm.exe"; Parameters: "stop AbsensiBackend"; Flags: runhidden
Filename: "{app}\nssm.exe"; Parameters: "remove AbsensiBackend confirm"; Flags: runhidden

[Code]
// Script kustom Inno Setup jika diperlukan
procedure InitializeWizard;
begin
  // Tambahkan logika pengecekan PostgreSQL di sini jika ingin auto-install database
end;
