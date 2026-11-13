param([switch]$Integration, [switch]$Browser, [switch]$Security)
. "$PSScriptRoot/common.ps1"
Assert-Repository
Assert-LocalEnvironment
Invoke-Checked -Executable pnpm -Arguments @('format:check')
Invoke-Checked -Executable pnpm -Arguments @('lint')
Invoke-Checked -Executable pnpm -Arguments @('typecheck')
Invoke-Checked -Executable pnpm -Arguments @('test')
Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'ruff', 'check', '.')
Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'ruff', 'format', '--check', '.')
Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'mypy')
Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'pytest', '-m', 'not integration')
if ($Integration) {
    $previousIntegration = $env:ZEAOPS_RUN_INTEGRATION
    $env:ZEAOPS_RUN_INTEGRATION = '1'
    try { Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'pytest', '-m', 'integration') }
    finally {
        if ($null -ne $previousIntegration) { $env:ZEAOPS_RUN_INTEGRATION = $previousIntegration }
        else { Remove-Item Env:ZEAOPS_RUN_INTEGRATION -ErrorAction SilentlyContinue }
    }
}
Invoke-Checked -Executable pnpm -Arguments @('build')
Invoke-Compose -ComposeArguments @('config', '--quiet')
if ($Browser) { Invoke-Checked -Executable pnpm -Arguments @('test:e2e') }
if ($Security) {
    Invoke-Checked -Executable pnpm -Arguments @('audit', '--audit-level', 'low')
    Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'pip-audit', '--local', '--progress-spinner', 'off')
    Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'pip', 'check', '--python', '.venv')
    Invoke-Checked -Executable python -Arguments @('-m', 'uv', 'run', '--locked', 'python', 'scripts/check_secrets.py', '--include-build')
}
