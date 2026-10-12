$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command go-winres -ErrorAction SilentlyContinue)) {
    go install github.com/tc-hib/go-winres@latest
    $env:Path += ";" + (Join-Path (go env GOPATH) 'bin')
}

node ..\tools\build-verses.js

if (Test-Path web) { Remove-Item web -Recurse -Force }
Copy-Item ..\src web -Recurse

go-winres make

$env:GOOS = 'windows'
$env:GOARCH = 'amd64'
$env:CGO_ENABLED = '0'
New-Item -ItemType Directory -Force ..\dist | Out-Null
go build -trimpath -ldflags "-H=windowsgui -s -w" -o ..\dist\ScriptureShield.exe .

Get-Item ..\dist\ScriptureShield.exe | Select-Object Name, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
