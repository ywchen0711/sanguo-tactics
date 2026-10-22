# Screenshot a page of the game with headless Edge and print its title (where the driver reports errors).
# powershell -File tools/shot.ps1 <query> <outname> [width] [height] [ms]
param([string]$q = 'stage=1', [string]$out = 'shot', [int]$w = 1280, [int]$h = 760, [int]$ms = 6000)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$tmp = "C:\Users\ywche\.claude\jobs\8582ca92\tmp"
$ud = "$tmp\ud_$out"
if (Test-Path $ud) { Remove-Item -Recurse -Force $ud -Confirm:$false }
$url = "file:///C:/SanguoTactics/tmp-drive.html?$q"
& $edge --headless=new --hide-scrollbars --allow-file-access-from-files --window-size=$w,$h "--user-data-dir=$ud" --virtual-time-budget=$ms "--screenshot=$tmp\$out.png" $url 2>$null | Out-Null
$ud2 = "$tmp\ud2_$out"
if (Test-Path $ud2) { Remove-Item -Recurse -Force $ud2 -Confirm:$false }
$dom = & $edge --headless=new --allow-file-access-from-files --window-size=$w,$h "--user-data-dir=$ud2" --virtual-time-budget=$ms --dump-dom $url 2>$null | Out-String
if ($dom -match '<title>(.*?)</title>') { $matches[1] } else { 'no title' }
