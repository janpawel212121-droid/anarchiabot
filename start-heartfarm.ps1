$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $root -WindowStyle Hidden
Start-Process "http://127.0.0.1:7124"
