# DevHub 快捷方式创建脚本
# 在桌面上创建 DevHub 应用的快捷方式

param(
    [switch]$Force = $false
)

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

Write-Host "=== DevHub 快捷方式创建工具 ===" -ForegroundColor Cyan
Write-Host ""

# 检查应用目录
$appDir = $PSScriptRoot
$appExe = Join-Path $appDir "start.bat"
$appIcon = Join-Path $appDir "app.ico"

if (-not (Test-Path $appExe)) {
    Write-Host "错误: 找不到启动文件 start.bat" -ForegroundColor Red
    Write-Host "请确保脚本在 DevHub 项目目录中运行" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $appIcon)) {
    Write-Host "警告: 找不到图标文件 app.ico" -ForegroundColor Yellow
    Write-Host "将使用默认图标" -ForegroundColor Yellow
}

# 桌面路径
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "DevHub.lnk"

# 检查快捷方式是否已存在
if (Test-Path $shortcutPath) {
    if (-not $Force) {
        Write-Host "快捷方式已存在: $shortcutPath" -ForegroundColor Yellow
        $choice = Read-Host "是否覆盖? (Y/N)"
        if ($choice -notmatch "^[Yy]$") {
            Write-Host "操作已取消" -ForegroundColor Yellow
            exit 0
        }
    }
    Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
}

# 创建快捷方式
try {
    # 创建 WScript.Shell 对象
    $WshShell = New-Object -ComObject WScript.Shell
    
    # 创建快捷方式
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = $appExe
    $Shortcut.WorkingDirectory = $appDir
    $Shortcut.Description = "DevHub - 个人 AI 编码中枢桌面应用"
    $Shortcut.WindowStyle = 1  # 正常窗口
    
    if (Test-Path $appIcon) {
        $Shortcut.IconLocation = $appIcon
    }
    
    $Shortcut.Save()
    
    Write-Host "✓ 快捷方式创建成功!" -ForegroundColor Green
    Write-Host "位置: $shortcutPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "使用说明:" -ForegroundColor Cyan
    Write-Host "1. 双击桌面上的 'DevHub' 快捷方式启动应用" -ForegroundColor White
    Write-Host "2. 首次启动需要安装依赖，请耐心等待" -ForegroundColor White
    Write-Host "3. 应用启动后会显示设置窗口，请填写 API 配置" -ForegroundColor White
    
} catch {
    Write-Host "错误: 创建快捷方式失败" -ForegroundColor Red
    Write-Host "详细信息: $_" -ForegroundColor Red
    
    if (-not $isAdmin) {
        Write-Host ""
        Write-Host "提示: 尝试以管理员身份运行此脚本" -ForegroundColor Yellow
        Write-Host "右键点击脚本 -> '以管理员身份运行'" -ForegroundColor Yellow
    }
    
    exit 1
}

# 可选：创建开始菜单快捷方式
$startMenuChoice = Read-Host "是否在开始菜单创建快捷方式? (Y/N)"
if ($startMenuChoice -match "^[Yy]$") {
    try {
        $startMenuPath = [Environment]::GetFolderPath("StartMenu")
        $startMenuFolder = Join-Path $startMenuPath "DevHub"
        
        if (-not (Test-Path $startMenuFolder)) {
            New-Item -ItemType Directory -Path $startMenuFolder -Force | Out-Null
        }
        
        $startMenuShortcut = Join-Path $startMenuFolder "DevHub.lnk"
        
        if (Test-Path $startMenuShortcut) {
            Remove-Item $startMenuShortcut -Force -ErrorAction SilentlyContinue
        }
        
        $WshShell = New-Object -ComObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut($startMenuShortcut)
        $Shortcut.TargetPath = $appExe
        $Shortcut.WorkingDirectory = $appDir
        $Shortcut.Description = "DevHub - 个人 AI 编码中枢桌面应用"
        $Shortcut.WindowStyle = 1
        
        if (Test-Path $appIcon) {
            $Shortcut.IconLocation = $appIcon
        }
        
        $Shortcut.Save()
        
        Write-Host "✓ 开始菜单快捷方式创建成功!" -ForegroundColor Green
        
    } catch {
        Write-Host "警告: 开始菜单快捷方式创建失败" -ForegroundColor Yellow
        Write-Host "详细信息: $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Cyan
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")