#Requires -Version 5.0
$ErrorActionPreference = "Stop"

$SkillSrc  = Join-Path $PSScriptRoot "skill\raptor\SKILL.md"
$SkillName = "raptor"

Write-Host ""
Write-Host "  🦖 Raptor Setup" -ForegroundColor Cyan
Write-Host ""

# --- Install CLI ---
Write-Host "Step 1: Install raptor CLI"
Write-Host "  Options:"
Write-Host "    1) Global install (npm install -g raptor-docgen)"
Write-Host "    2) Skip (already installed or will use npx)"
Write-Host ""
$cliChoice = Read-Host "  Choice [1/2]"

switch ($cliChoice) {
    "1" {
        Write-Host "  Installing raptor-docgen globally..." -ForegroundColor Yellow
        npm install -g raptor-docgen
        Write-Host "  ✅ CLI installed" -ForegroundColor Green
    }
    default {
        Write-Host "  ⏭  Skipping CLI install" -ForegroundColor Gray
    }
}

# --- Install skill ---
Write-Host ""
Write-Host "Step 2: Install skill"
Write-Host "  Agents:"
Write-Host "    1) GitHub Copilot CLI  (~\.copilot\skills\raptor\)"
Write-Host "    2) Claude Code         (~\.claude\commands\raptor.md)"
Write-Host "    3) Cursor              (.cursor\rules\raptor.mdc)"
Write-Host "    4) All of the above"
Write-Host "    5) Skip"
Write-Host ""
$agentChoice = Read-Host "  Choice [1-5]"

function Install-Copilot {
    $dest = Join-Path $env:USERPROFILE ".copilot\skills\$SkillName"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item $SkillSrc "$dest\SKILL.md" -Force
    Write-Host "  ✅ Copilot: $dest\SKILL.md" -ForegroundColor Green
}

function Install-Claude {
    $dest = Join-Path $env:USERPROFILE ".claude\commands"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item $SkillSrc "$dest\$SkillName.md" -Force
    Write-Host "  ✅ Claude Code: $dest\$SkillName.md" -ForegroundColor Green
}

function Install-Cursor {
    $dest = ".cursor\rules"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item $SkillSrc "$dest\$SkillName.mdc" -Force
    Write-Host "  ✅ Cursor: $dest\$SkillName.mdc" -ForegroundColor Green
}

switch ($agentChoice) {
    "1" { Install-Copilot }
    "2" { Install-Claude }
    "3" { Install-Cursor }
    "4" { Install-Copilot; Install-Claude; Install-Cursor }
    default { Write-Host "  ⏭  Skipping skill install" -ForegroundColor Gray }
}

Write-Host ""
Write-Host "  ✅ Raptor setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Usage: ask your AI assistant to 'generate documentation' or 'run raptor'"
Write-Host "  Docs:  https://github.com/Kobe-eng-it/raptor"
Write-Host ""
