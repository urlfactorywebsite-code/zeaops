param([switch]$SkipInstall)
. "$PSScriptRoot/common.ps1"
Assert-Repository
foreach ($command in @('node', 'pnpm', 'python', 'docker')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Missing prerequisite: $command. See README.md." }
}
Assert-LocalDocker
$dockerType = & docker info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $dockerType -ne 'linux') { throw 'Start Docker Desktop using Linux containers.' }
if (-not $SkipInstall) {
    & python -m uv --version
    if ($LASTEXITCODE -ne 0) { throw 'Missing uv. Install with: python -m pip install uv==0.13.8' }
}
if (-not (Test-Path -LiteralPath '.env')) {
    $randomBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
    $devPassword = -join ($randomBytes | ForEach-Object { $_.ToString('x2') })
    $envText = @"
COMPOSE_PROJECT_NAME=zeaops-dev
POSTGRES_USER=zeaops_dev
POSTGRES_DB=zeaops_metadata_dev
POSTGRES_PASSWORD=$devPassword
ZEAOPS_ENVIRONMENT=development
ZEAOPS_LOG_LEVEL=INFO
ZEAOPS_DATABASE_URL=postgresql+psycopg://zeaops_dev:${devPassword}@127.0.0.1:18432/zeaops_metadata_dev
ZEAOPS_API_INTERNAL_URL=http://127.0.0.1:18301
"@
    [System.IO.File]::WriteAllText((Join-Path $script:RepoRoot '.env'), $envText + "`n", (New-Object System.Text.UTF8Encoding $false))
    Write-Host 'Created ignored .env with a random development password.'
}
Assert-LocalEnvironment
if (-not $SkipInstall) {
    Invoke-Checked -Executable pnpm -Arguments @('install', '--frozen-lockfile')
    Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'sync', '--system-certs', '--locked')
}
Invoke-Compose -ComposeArguments @('config', '--quiet')
Write-Host 'Setup complete. Run ./scripts/dev.ps1 -Mode infra, then api and web in separate terminals.'
