using System;using System.IO;using System.Drawing;using System.Windows.Forms;using System.Runtime.InteropServices;
class PetUnderlay:Form{
 [StructLayout(LayoutKind.Sequential)]struct Rect{public int L,T,R,B;}
 [DllImport("user32.dll")]static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")]static extern bool GetWindowRect(IntPtr h,out Rect r);
 string counter;int clicks;
 PetUnderlay(IntPtr root,string file){counter=file;Rect r;GetWindowRect(root,out r);AutoScaleMode=AutoScaleMode.None;FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.Manual;Bounds=new Rectangle(r.L,r.T,r.R-r.L,r.B-r.T);BackColor=Color.LightBlue;TopMost=true;}
 protected override void OnShown(EventArgs e){base.OnShown(e);File.WriteAllText(counter,"0");File.WriteAllText(counter+".hwnd",Handle.ToInt64().ToString());}
 protected override void OnMouseUp(MouseEventArgs e){base.OnMouseUp(e);clicks++;File.WriteAllText(counter,clicks.ToString());}
 [STAThread]static void Main(string[] args){SetProcessDPIAware();Application.EnableVisualStyles();Application.Run(new PetUnderlay(new IntPtr(long.Parse(args[0])),args[1]));}
}
