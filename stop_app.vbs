Set WshShell = CreateObject("WScript.Shell")
' Mematikan proses node.exe
WshShell.Run "taskkill /F /IM node.exe", 0, False
MsgBox "Aplikasi Nebula Smart Presence telah dihentikan.", 64, "Informasi"
