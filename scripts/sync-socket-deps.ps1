param()

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$tempRoot = Join-Path $projectRoot ".vendor-tmp"

$packages = @(
    @{ Name = "socket.io-client"; Version = "4.8.3" },
    @{ Name = "engine.io-client"; Version = "6.6.4" },
    @{ Name = "engine.io-parser"; Version = "5.2.3" },
    @{ Name = "socket.io-parser"; Version = "4.2.4" },
    @{ Name = "@socket.io/component-emitter"; Version = "3.1.2" },
    @{ Name = "debug"; Version = "4.4.1" },
    @{ Name = "ms"; Version = "2.1.3" },
    @{ Name = "ws"; Version = "8.18.3" },
    @{ Name = "xmlhttprequest-ssl"; Version = "2.1.1" }
)

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Reset-Directory {
    param([string]$Path)
    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Get-SafeName {
    param([string]$PackageName)
    return ($PackageName -replace "@", "" -replace "/", "__")
}

function Download-Package {
    param(
        [string]$PackageName,
        [string]$Version
    )

    $encodedName = [System.Uri]::EscapeDataString($PackageName)
    $metaUrl = "https://registry.npmjs.org/$encodedName/$Version"
    $meta = Invoke-RestMethod -Uri $metaUrl -Method Get

    $safeName = Get-SafeName $PackageName
    $extractRoot = Join-Path $tempRoot $safeName
    $archivePath = Join-Path $tempRoot "$safeName.tgz"

    if (Test-Path $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }

    Ensure-Directory $extractRoot
    Invoke-WebRequest -Uri $meta.dist.tarball -OutFile $archivePath
    tar -xf $archivePath -C $extractRoot

    return Join-Path $extractRoot "package"
}

function Copy-PackageToNodeModules {
    param(
        [string]$PackageName,
        [string]$PackagePath
    )

    $segments = $PackageName.Split("/")
    if ($PackageName.StartsWith("@")) {
        $scopeDir = Join-Path (Join-Path $projectRoot "node_modules") $segments[0]
        Ensure-Directory $scopeDir
        $targetPath = Join-Path $scopeDir $segments[1]
    }
    else {
        $targetPath = Join-Path (Join-Path $projectRoot "node_modules") $PackageName
    }

    if (Test-Path $targetPath) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
    }

    Copy-Item -LiteralPath $PackagePath -Destination $targetPath -Recurse -Force
}

function Sync-Directory {
    param(
        [string]$SourcePath,
        [string]$TargetPath
    )

    if (-not (Test-Path $SourcePath)) {
        throw "Brak zrodla do synchronizacji: $SourcePath"
    }

    $targetParent = Split-Path -Parent $TargetPath
    Ensure-Directory $targetParent

    if (Test-Path $TargetPath) {
        Remove-Item -LiteralPath $TargetPath -Recurse -Force
    }

    Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Recurse -Force
}

Ensure-Directory $tempRoot
Ensure-Directory (Join-Path $projectRoot "node_modules")
Ensure-Directory (Join-Path $projectRoot "scripts")

$downloaded = @{}

foreach ($package in $packages) {
    $packageName = $package.Name
    $packageVersion = $package.Version
    $packagePath = Download-Package -PackageName $packageName -Version $packageVersion
    $downloaded[$packageName] = $packagePath
    Copy-PackageToNodeModules -PackageName $packageName -PackagePath $packagePath
}

Sync-Directory -SourcePath (Join-Path $downloaded["socket.io-client"] "build\esm-debug") -TargetPath (Join-Path $projectRoot "build\esm-debug")
Sync-Directory -SourcePath (Join-Path $downloaded["engine.io-client"] "build\esm") -TargetPath (Join-Path $projectRoot "engine.io-client\build\esm")
Sync-Directory -SourcePath (Join-Path $downloaded["engine.io-parser"] "build\esm") -TargetPath (Join-Path $projectRoot "engine.io-parser\build\esm")
Sync-Directory -SourcePath (Join-Path $downloaded["@socket.io/component-emitter"] "lib\esm") -TargetPath (Join-Path $projectRoot "socket.io-component-emitter\lib\esm")
Sync-Directory -SourcePath (Join-Path $downloaded["socket.io-parser"] "build\esm") -TargetPath (Join-Path $projectRoot "socket.io-parser\build\esm")

Write-Host "Socket.IO dependencies have been synced." -ForegroundColor Green
