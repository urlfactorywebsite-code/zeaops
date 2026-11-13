# Fresh migration/runtime proof in a unique, port-free disposable Compose project.
. "$PSScriptRoot/common.ps1"
Assert-Repository
Assert-LocalEnvironment
Assert-LocalDocker
$smokeProject = 'zeaops-smoke-' + [Guid]::NewGuid().ToString('N')
$overridePath = Join-Path ([System.IO.Path]::GetTempPath()) ($smokeProject + '.yaml')
$overrideText = @'
services:
  postgres:
    ports: !reset []
  api:
    ports: !reset []
  web:
    ports: !reset []
'@
function Invoke-SmokeCompose {
    param([string[]]$SmokeArguments)
    Invoke-Compose -ComposeArguments (@('--project-name', $smokeProject, '-f', $overridePath) + $SmokeArguments)
}
try {
    [System.IO.File]::WriteAllText($overridePath, $overrideText, (New-Object System.Text.UTF8Encoding $false))
    Invoke-SmokeCompose -SmokeArguments @('config', '--quiet')
    Invoke-SmokeCompose -SmokeArguments @('up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '120')
    Invoke-SmokeCompose -SmokeArguments @('exec', '-T', 'api', 'alembic', '-c', 'apps/api/alembic.ini', 'upgrade', 'head')
    Invoke-SmokeCompose -SmokeArguments @('exec', '-T', 'api', 'alembic', '-c', 'apps/api/alembic.ini', 'check')
    Invoke-SmokeCompose -SmokeArguments @('exec', '-T', 'api', 'python', '-c', "import json,urllib.request; assert json.load(urllib.request.urlopen('http://127.0.0.1:18301/health/ready', timeout=6))['status']=='ready'; print('Fresh database/API readiness: PASS')")
    Invoke-SmokeCompose -SmokeArguments @('exec', '-T', 'web', 'node', '-e', "fetch('http://127.0.0.1:18300/api/health/ready',{signal:AbortSignal.timeout(8000)}).then(async r=>{if(r.status!==200||(await r.json()).status!=='ready')process.exit(1);console.log('Fresh stack proxy: PASS')}).catch(()=>process.exit(1))")
} finally {
    # This generated project is the only deletion target; never remove zeaops-dev volumes.
    try { Invoke-SmokeCompose -SmokeArguments @('down', '--volumes', '--remove-orphans') }
    finally { if (Test-Path -LiteralPath $overridePath) { Remove-Item -LiteralPath $overridePath } }
}
