param([string]$HBuilderX = 'D:\HBuilderX\HBuilderX')
$ErrorActionPreference = 'Stop'
$taskAppRoot = Split-Path $PSScriptRoot -Parent
$taskStage = Join-Path $taskAppRoot 'unpackage\browser-qa\source'
New-Item -ItemType Directory -Path $taskStage -Force | Out-Null
& robocopy $taskAppRoot $taskStage /E /XD node_modules unpackage .hbuilderx /XF project.private.config.json /R:0 /W:0 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Could not stage browser preview (robocopy $LASTEXITCODE)." }
# The browser preview exercises the native App login form; it is not Web source.
$taskConfig = Join-Path $taskStage 'common\config.js'
$taskText = [IO.File]::ReadAllText($taskConfig).Replace('export const APP_LOGIN = appLogin','export const APP_LOGIN = true')
[IO.File]::WriteAllText($taskConfig,$taskText,[Text.UTF8Encoding]::new($false))
$taskIndex = @'
<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Zhiyou App QA</title><!--preload-links--><!--app-context--></head><body><div id="app"><!--app-html--></div><script type="module" src="/main.js"></script></body></html>
'@
[IO.File]::WriteAllText((Join-Path $taskStage 'index.html'),$taskIndex,[Text.UTF8Encoding]::new($false))
$taskCompiler = Join-Path $HBuilderX 'plugins\uniapp-cli-vite'
$env:UNI_INPUT_DIR = $taskStage
$env:UNI_OUTPUT_DIR = Join-Path $taskAppRoot 'unpackage\browser-qa\dist'
$env:UNI_CLI_CONTEXT = $taskCompiler
$env:UNI_HBUILDERX_PLUGINS = Join-Path $HBuilderX 'plugins'
$env:NODE_ENV = 'production'
$env:UNI_PLATFORM = 'h5'
Push-Location -LiteralPath $taskCompiler
try {
    & (Join-Path $HBuilderX 'plugins\node\node.exe') 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js' build --platform h5 --config vite.config.js
    if ($LASTEXITCODE -ne 0) { throw "Browser preview compilation failed ($LASTEXITCODE)." }
} finally { Pop-Location }
if (-not (Test-Path -LiteralPath (Join-Path $env:UNI_OUTPUT_DIR 'index.html'))) { throw 'Browser preview did not produce index.html.' }
Write-Host 'App browser preview built. Its requests must be mocked by browser-preview.cjs.'
