@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    DevHub 搴旂敤璁剧疆楠岃瘉宸ュ叿
echo ========================================
echo.

echo [1/4] 妫€鏌ュ浘鏍囨枃浠?..
if exist "app.ico" (
    echo   鉁?鍥炬爣鏂囦欢 app.ico 瀛樺湪
    for %%F in ("app.ico") do set size=%%~zF
    set /a size_kb=!size!/1024
    echo   - 鏂囦欢澶у皬: !size_kb! KB
) else (
    echo   鉁?鍥炬爣鏂囦欢 app.ico 涓嶅瓨鍦?
    echo   - 璇蜂粠妗岄潰绱犳潗鏂囦欢澶瑰鍒?
    echo   - 鍛戒护: # Copy your .ico file here
)

echo.
echo [2/4] 妫€鏌ュ簲鐢ㄩ厤缃?..
findstr /C:"icon:" main.js >nul
if %errorlevel% equ 0 (
    echo   鉁?main.js 涓凡閰嶇疆鍥炬爣
    for /f "tokens=*" %%i in ('findstr /n /C:"icon:" main.js') do (
        echo   - 閰嶇疆琛? %%i
    )
) else (
    echo   鉁?main.js 涓湭閰嶇疆鍥炬爣
)

echo.
echo [3/4] 妫€鏌ュ揩鎹锋柟寮忓伐鍏?..
if exist "鍒涘缓蹇嵎鏂瑰紡.bat" (
    echo   鉁?鍒涘缓蹇嵎鏂瑰紡.bat 瀛樺湪
) else (
    echo   鉁?鍒涘缓蹇嵎鏂瑰紡.bat 涓嶅瓨鍦?
)

if exist "create-shortcut.ps1" (
    echo   鉁?create-shortcut.ps1 瀛樺湪
) else (
    echo   鉁?create-shortcut.ps1 涓嶅瓨鍦?
)

echo.
echo [4/4] 妫€鏌ユ闈㈠揩鎹锋柟寮?..
if exist "%USERPROFILE%\Desktop\DevHub.lnk" (
    echo   鉁?妗岄潰蹇嵎鏂瑰紡宸插瓨鍦?
    echo   - 璺緞: %USERPROFILE%\Desktop\DevHub.lnk
) else (
    echo   - 妗岄潰蹇嵎鏂瑰紡涓嶅瓨鍦?
    echo   - 璇疯繍琛?"鍒涘缓蹇嵎鏂瑰紡.bat" 鏉ュ垱寤?
)

echo.
echo ========================================
echo   楠岃瘉瀹屾垚
echo ========================================
echo.
echo 涓嬩竴姝ユ搷浣?
echo 1. 濡傛灉鍥炬爣鏂囦欢涓嶅瓨鍦紝璇峰厛澶嶅埗鍥炬爣
echo 2. 杩愯 "鍒涘缓蹇嵎鏂瑰紡.bat" 鍒涘缓妗岄潰蹇嵎鏂瑰紡
echo 3. 鍙屽嚮妗岄潰涓婄殑 "DevHub" 蹇嵎鏂瑰紡鍚姩搴旂敤
echo.
pause