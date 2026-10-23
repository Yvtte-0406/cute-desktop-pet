param([int]$X,[int]$Y,[long]$Handle=0,[double]$RatioX=0,[double]$RatioY=0,[ValidateSet('left','right')][string]$Button='left')
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class PetMouseQA {
 [StructLayout(LayoutKind.Sequential)] public struct Point {public int X;public int Y;}
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [StructLayout(LayoutKind.Sequential)] public struct Rect {public int Left;public int Top;public int Right;public int Bottom;}
 [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h,ref Point p);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("gdi32.dll")] public static extern IntPtr CreateRectRgn(int a,int b,int c,int d);
 [DllImport("user32.dll")] public static extern int GetWindowRgn(IntPtr h,IntPtr r);
 [DllImport("gdi32.dll")] public static extern bool PtInRegion(IntPtr r,int x,int y);
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out int value,int size);
}
'@
[PetMouseQA]::SetProcessDPIAware() | Out-Null
if($Handle -gt 0){
 $nativeRect=New-Object PetMouseQA+Rect
 [PetMouseQA]::GetClientRect([IntPtr]$Handle,[ref]$nativeRect) | Out-Null
 $nativePoint=New-Object PetMouseQA+Point
 $nativePoint.X=[int](($nativeRect.Right-$nativeRect.Left)*$RatioX)
 $nativePoint.Y=[int](($nativeRect.Bottom-$nativeRect.Top)*$RatioY)
 $nativeRegion=[PetMouseQA]::CreateRectRgn(0,0,0,0)
 $regionResult=[PetMouseQA]::GetWindowRgn([IntPtr]$Handle,$nativeRegion)
 $insideRegion=[PetMouseQA]::PtInRegion($nativeRegion,$nativePoint.X,$nativePoint.Y)
 $rootVisible=[PetMouseQA]::IsWindowVisible([IntPtr]$Handle)
 $extendedStyle=[PetMouseQA]::GetWindowLong([IntPtr]$Handle,-20)
 $cloaked=0
 [PetMouseQA]::DwmGetWindowAttribute([IntPtr]$Handle,14,[ref]$cloaked,4) | Out-Null
 [PetMouseQA]::ClientToScreen([IntPtr]$Handle,[ref]$nativePoint) | Out-Null
 $X=$nativePoint.X;$Y=$nativePoint.Y
}
$previousPoint = New-Object PetMouseQA+Point
[PetMouseQA]::GetCursorPos([ref]$previousPoint) | Out-Null
try {
 [PetMouseQA]::SetCursorPos($X,$Y) | Out-Null
 Start-Sleep -Milliseconds 120
 [PetMouseQA]::SetCursorPos($X,$Y) | Out-Null
 $probePoint = New-Object PetMouseQA+Point
 [PetMouseQA]::GetCursorPos([ref]$probePoint) | Out-Null
 $nativeTarget = [PetMouseQA]::GetAncestor([PetMouseQA]::WindowFromPoint($probePoint),2)
 [PetMouseQA]::SetCursorPos($X,$Y) | Out-Null
 $downFlag=if($Button -eq 'right'){8}else{2}
 $upFlag=if($Button -eq 'right'){16}else{4}
 [PetMouseQA]::mouse_event($downFlag,0,0,0,[UIntPtr]::Zero)
 [PetMouseQA]::mouse_event($upFlag,0,0,0,[UIntPtr]::Zero)
 Write-Output ('target=' + $nativeTarget.ToInt64() + ';x=' + $probePoint.X + ';y=' + $probePoint.Y+';visible='+$rootVisible+';region='+$regionResult+';inside='+$insideRegion+';style='+$extendedStyle+';cloaked='+$cloaked)
 Start-Sleep -Milliseconds 100
} finally { [PetMouseQA]::SetCursorPos($previousPoint.X,$previousPoint.Y) | Out-Null }
