Set WshShell = CreateObject("WScript.Shell")

' Jalankan Node.js backend tanpa window command prompt (0)
WshShell.Run "node.exe backend\index.js", 0, False
