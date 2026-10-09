param([string]$ServerAddress)
$ErrorActionPreference = 'Stop'
if (-not $ServerAddress) {
    $adapter = Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -First 1
    if (-not $adapter) { throw '没有可用的物理网卡，请传入 -ServerAddress http://电脑IP:8000' }
    $address = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1
    if (-not $address) { throw '没有可用的 IPv4 地址' }
    $ServerAddress = 'http://' + $address.IPAddress + ':8000'
}
$uri = [uri]$ServerAddress
if ($uri.Scheme -notin @('http','https') -or $uri.AbsolutePath -ne '/') { throw '请提供不含路径的 HTTP/HTTPS 地址' }
$configPath = Join-Path $PSScriptRoot '../miniprogram/common/config.js'
$source = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8
$source = $source -replace "export const LAN_SERVER_ORIGIN = '[^']*'", ("export const LAN_SERVER_ORIGIN = '" + $uri.GetLeftPart([System.UriPartial]::Authority) + "'")
Set-Content -LiteralPath $configPath -Value $source -Encoding utf8
Write-Output ('小程序后端地址：' + $ServerAddress)
