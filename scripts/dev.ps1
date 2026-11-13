param([ValidateSet('infra', 'api', 'web', 'stack', 'stop')][string]$Mode = 'infra')
. "$PSScriptRoot/common.ps1"
Assert-Repository
Assert-LocalEnvironment
switch ($Mode) {
    'infra' {
        Invoke-Compose -ComposeArguments @('up', '-d', '--wait', 'postgres')
        Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'alembic', '-c', 'apps/api/alembic.ini', 'upgrade', 'head')
    }
    'api' { Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'uvicorn', 'zeaops.main:create_app', '--factory', '--app-dir', 'apps/api/src', '--host', '127.0.0.1', '--port', '18301', '--reload', '--no-access-log') }
    'web' {
        $env:ZEAOPS_API_INTERNAL_URL = 'http://127.0.0.1:18301'
        try { Invoke-Checked -Executable pnpm -Arguments @('dev') }
        finally { Remove-Item Env:ZEAOPS_API_INTERNAL_URL -ErrorAction SilentlyContinue }
    }
    'stack' { Invoke-Compose -ComposeArguments @('up', '-d', '--build', '--wait') }
    'stop' { Invoke-Compose -ComposeArguments @('down') }
}
