Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:RepoRoot = Split-Path -Parent $PSScriptRoot
# Optional verified workspace-local runtime; fresh clones can use the documented Node prerequisite.
$projectNode = Join-Path $script:RepoRoot '.tools/node-v24.22.3-win-x64'
if (Test-Path -LiteralPath (Join-Path $projectNode 'node.exe')) {
    $env:Path = $projectNode + [System.IO.Path]::PathSeparator + $env:Path
}

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}

function Assert-Repository {
    if ((Get-Location).Path -ne $script:RepoRoot) { throw "Run this script from $script:RepoRoot" }
}

function Read-LocalEnvironment {
    param([string]$Path = (Join-Path $script:RepoRoot '.env'))
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'Run ./scripts/setup.ps1 first.' }
    $values = @{}
    $keys = @('COMPOSE_PROJECT_NAME', 'POSTGRES_USER', 'POSTGRES_DB', 'POSTGRES_PASSWORD',
        'ZEAOPS_ENVIRONMENT', 'ZEAOPS_LOG_LEVEL', 'ZEAOPS_DATABASE_URL', 'ZEAOPS_API_INTERNAL_URL')
    foreach ($line in (Get-Content -LiteralPath $Path)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
        if ($line -cnotmatch '^([A-Z_]+)=(.*)$') { throw 'Invalid local environment entry.' }
        $key = $Matches[1]
        $value = $Matches[2]
        if ($keys -cnotcontains $key -or $values.ContainsKey($key)) {
            throw 'Unknown or duplicate local environment key.'
        }
        $values[$key] = $value
    }
    if ($values.Count -ne $keys.Count -or
        $values.COMPOSE_PROJECT_NAME -cne 'zeaops-dev' -or
        $values.POSTGRES_USER -cne 'zeaops_dev' -or
        $values.POSTGRES_DB -cne 'zeaops_metadata_dev' -or
        $values.POSTGRES_PASSWORD -cnotmatch '^[a-f0-9]{64}$' -or
        $values.ZEAOPS_ENVIRONMENT -cne 'development' -or
        $values.ZEAOPS_LOG_LEVEL -cnotmatch '^(DEBUG|INFO|WARNING|ERROR)$' -or
        $values.ZEAOPS_API_INTERNAL_URL -cne 'http://127.0.0.1:18301' -or
        $values.ZEAOPS_DATABASE_URL -cne "postgresql+psycopg://zeaops_dev:$($values.POSTGRES_PASSWORD)@127.0.0.1:18432/zeaops_metadata_dev") {
        throw 'Local environment guard failed. Use the generated, consistent development .env.'
    }
    return $values
}

function Assert-LocalEnvironment {
    $null = Read-LocalEnvironment
    $overrides = Get-ChildItem Env: | Where-Object {
        $_.Name -match '^(PG|POSTGRES_|COMPOSE_)' -or
        $_.Name -match '^ZEAOPS_(DATABASE_URL|ENVIRONMENT|API_INTERNAL_URL)$'
    }
    if ($overrides) { throw 'Clear inherited PostgreSQL, ZeaOPS connection, and Compose overrides before using local scripts.' }
}

function Assert-LocalDocker {
    if ($env:DOCKER_HOST) { $endpoint = $env:DOCKER_HOST }
    else {
        $endpoint = & docker context inspect --format '{{.Endpoints.docker.Host}}'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the Docker context. Start Docker Desktop.' }
    }
    if ($endpoint -notmatch '^(npipe:////\./pipe/|unix:///)' -or $env:DOCKER_TLS_VERIFY) {
        throw 'Local scripts require a local Docker named pipe or Unix socket; remote Docker endpoints are refused.'
    }
}

function Invoke-Compose {
    param([string[]]$ComposeArguments)
    Assert-LocalEnvironment
    Assert-LocalDocker
    Invoke-Checked -Executable docker -Arguments (@('compose', '--env-file', '.env', '-f', 'infrastructure/compose/compose.yaml') + $ComposeArguments)
}
