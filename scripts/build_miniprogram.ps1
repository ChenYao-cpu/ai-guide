param([string]$HBuilderPath = 'E:/HBuilderX')
$ErrorActionPreference = 'Stop'
$compiler = Join-Path $HBuilderPath 'plugins/uniapp-cli-vite'
$cli = Join-Path $compiler 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'
if (-not (Test-Path -LiteralPath $cli)) { throw '未找到 HBuilderX 的 uni-app 编译器，请传入 -HBuilderPath' }
$inputProjectPath = Join-Path $PSScriptRoot '../miniprogram'
if ($env:ZHIYOU_MINI_PROJECT) { $inputProjectPath = $env:ZHIYOU_MINI_PROJECT }
$project = [System.IO.Path]::GetFullPath($inputProjectPath)
# Preserve the local simulator test AppID. The source AppID remains unchanged.
$previousOutputConfigPath = Join-Path $project 'unpackage/dist/dev/mp-weixin/project.config.json'
$previewAppId = $null
if (Test-Path -LiteralPath $previousOutputConfigPath) {
    $previousOutputConfig = Get-Content -LiteralPath $previousOutputConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $sourceConfig = Get-Content -LiteralPath (Join-Path $project 'project.config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($previousOutputConfig.appid -ne $sourceConfig.appid) { $previewAppId = $previousOutputConfig.appid }
}
# Refresh the actual Wi-Fi address before compiling a local development build.
$taskWifi = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object { $_.NetworkInterfaceType -eq 'Wireless80211' -and $_.OperationalStatus -eq 'Up' } | Select-Object -First 1
if ($taskWifi) {
    $taskWifiAddress = $taskWifi.GetIPProperties().UnicastAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
    if ($taskWifiAddress) {
        $taskConfigPath = Join-Path $project 'common/config.js'
        $taskConfigText = [System.IO.File]::ReadAllText($taskConfigPath)
        $taskConfigText = $taskConfigText -replace "export const LAN_SERVER_ORIGIN = 'http://[^']+'", "export const LAN_SERVER_ORIGIN = 'http://$($taskWifiAddress.Address):8000'"
        [System.IO.File]::WriteAllText($taskConfigPath, $taskConfigText, (New-Object System.Text.UTF8Encoding($false)))
    }
}
$env:UNI_INPUT_DIR = $project
$env:UNI_OUTPUT_DIR = Join-Path $project 'unpackage/dist/dev/mp-weixin'
$env:UNI_CLI_CONTEXT = $compiler
$env:UNI_HBUILDERX_PLUGINS = Join-Path $HBuilderPath 'plugins'
$env:NODE_ENV = 'development'
$env:UNI_PLATFORM = 'mp-weixin'
Push-Location $compiler
try { & (Join-Path $HBuilderPath 'plugins/node/node.exe') $cli build --platform mp-weixin --mode development --config (Join-Path $compiler 'vite.config.js'); if ($LASTEXITCODE -ne 0) { throw '小程序编译失败' }; if (-not (Test-Path -LiteralPath (Join-Path $env:UNI_OUTPUT_DIR 'app.json'))) { throw '编译器没有输出 app.json，不能作为成功预览' } }
finally { Pop-Location }
$outputConfigPath = Join-Path $env:UNI_OUTPUT_DIR 'project.config.json'
$outputConfig = Get-Content -LiteralPath $outputConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
# HBuilder copies the source project config. The built project already contains
# app.json at its root and must not resolve the source's nested output path again.
$outputConfig | Add-Member -NotePropertyName miniprogramRoot -NotePropertyValue './' -Force
if ($previewAppId) { $outputConfig | Add-Member -NotePropertyName appid -NotePropertyValue $previewAppId -Force }
$outputConfig.setting | Add-Member -NotePropertyName urlCheck -NotePropertyValue $false -Force
$outputConfigJson = $outputConfig | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText($outputConfigPath, $outputConfigJson, (New-Object System.Text.UTF8Encoding($false)))
# Devtools creates an overriding private config on first import. Local HTTP APIs
# require the same development URL-check setting as manifest.json.
$privateConfigPath = Join-Path $env:UNI_OUTPUT_DIR 'project.private.config.json'
if (Test-Path -LiteralPath $privateConfigPath) {
    $privateConfig = Get-Content -LiteralPath $privateConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $privateConfig.setting | Add-Member -NotePropertyName urlCheck -NotePropertyValue $false -Force
    [System.IO.File]::WriteAllText($privateConfigPath, ($privateConfig | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
}
