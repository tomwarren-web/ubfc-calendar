# UBFC Calendar — FA Full-Time fetcher
#
# The FA's WAF blocks requests from cloud hosts (Netlify/AWS and GitHub
# Actions both time out), so this script runs on a home machine instead:
# it pulls each configured team's public FA Full-Time page and posts the
# HTML to the calendar's sync endpoint, which parses and reconciles the
# fixtures and emails a change summary.
#
# Scheduled via Windows Task Scheduler (daily, catches up after the PC was
# off). The sync secret lives in %USERPROFILE%\.ubfc\sync-secret.txt.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$site = "https://ubfc-calendar.netlify.app"
$secretPath = Join-Path $env:USERPROFILE ".ubfc\sync-secret.txt"
$secret = (Get-Content $secretPath -Raw).Trim()
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

$config = Invoke-RestMethod -Uri "$site/api/fulltime-sync?key=$secret" -Method GET
Write-Host "Teams configured: $(@($config).Count)"

$pages = @()
foreach ($team in @($config)) {
    try {
        $resp = Invoke-WebRequest -Uri $team.url -UserAgent $ua -UseBasicParsing -TimeoutSec 30
        $html = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
        $pages += @{ appTeam = $team.appTeam; html = $html }
        Write-Host "Fetched: $($team.appTeam) ($($html.Length) bytes)"
    } catch {
        Write-Warning "Failed to fetch $($team.appTeam): $($_.Exception.Message)"
    }
}

$json = @{ pages = $pages } | ConvertTo-Json -Depth 4 -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$report = Invoke-RestMethod -Uri "$site/api/fulltime-sync" -Method POST `
    -ContentType "application/json; charset=utf-8" `
    -Headers @{ "x-sync-key" = $secret } -Body $bytes
$report | ConvertTo-Json -Depth 5

if (@($report.errors).Count -gt 0) { exit 1 }
