$ErrorActionPreference='Stop'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class PetTimeReadOnly {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] public static extern int GetUserDefaultLocaleName(StringBuilder value,int size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] public static extern int GetLocaleInfoEx(string name,uint field,StringBuilder value,int size);
 public static string UserLocale(){var b=new StringBuilder(85);if(GetUserDefaultLocaleName(b,b.Capacity)==0)throw new Exception("GetUserDefaultLocaleName failed");return b.ToString();}
 public static string Read(string locale,uint field){var b=new StringBuilder(256);if(GetLocaleInfoEx(locale,field,b,b.Capacity)==0)throw new Exception("GetLocaleInfoEx failed: "+field);return b.ToString();}
}
'@
$locale=[PetTimeReadOnly]::UserLocale()
$zone=[TimeZoneInfo]::Local
$now=[DateTimeOffset]::Now
$international=Get-ItemProperty -LiteralPath 'HKCU:\Control Panel\International'
$extra=@{}
foreach($property in $international.PSObject.Properties){if($property.Name -match 'Calendar' -and $property.Name -ne 'iCalendarType'){$extra[$property.Name]=$property.Value}}
$result=[ordered]@{
 capturedAt=$now.ToString('o')
 utc=$now.UtcDateTime.ToString('o')
 timezoneId=$zone.Id
 timezoneDisplayName=$zone.DisplayName
 utcOffset=$now.Offset.ToString()
 userLocale=$locale
 defaultCalendarType=[PetTimeReadOnly]::Read($locale,0x1009)
 shortDateFormat=[PetTimeReadOnly]::Read($locale,0x1f)
 longDateFormat=[PetTimeReadOnly]::Read($locale,0x20)
 timeFormat=[PetTimeReadOnly]::Read($locale,0x1003)
 firstDayOfWeek=[PetTimeReadOnly]::Read($locale,0x100c)
 additionalCalendarRaw=$extra
 source='Windows NLS user settings and Windows local timezone; read only; no calendar tables or network calls'
}
$result|ConvertTo-Json -Depth 4
