using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Threading;

// User-authorized click-only observation, enabled by the parent ONLY while its
// reminder bubble is visible. No keyboard hook, movement stream or retained log.
class PresenceHelper : Form {
 [DllImport("user32.dll", SetLastError=true)] static extern IntPtr RegisterPowerSettingNotification(IntPtr h,ref Guid g,uint flags);
 [DllImport("user32.dll")] static extern bool UnregisterPowerSettingNotification(IntPtr h);
 [DllImport("wtsapi32.dll")] static extern bool WTSRegisterSessionNotification(IntPtr h,int flags);
 [DllImport("wtsapi32.dll")] static extern bool WTSUnRegisterSessionNotification(IntPtr h);
 [DllImport("wtsapi32.dll",SetLastError=true)] static extern bool WTSQuerySessionInformation(IntPtr server,int session,int info,out IntPtr buffer,out int bytes);
 [DllImport("wtsapi32.dll")] static extern void WTSFreeMemory(IntPtr p);
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr SetWindowsHookEx(int id,MouseProc proc,IntPtr module,uint thread);
 [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
 [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
 [StructLayout(LayoutKind.Sequential)] struct Point {public int X,Y;public Point(int x,int y){X=x;Y=y;}}
 [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window,uint flags);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 delegate IntPtr MouseProc(int code,IntPtr message,IntPtr data);
 IntPtr notification,mouseHook;MouseProc mouseProc;System.Windows.Forms.Timer parentTimer=new System.Windows.Forms.Timer();bool closing;int parentId;
 static bool Protected(int parent,int x,int y){IntPtr target=WindowFromPoint(new Point(x,y));if(target==IntPtr.Zero)return false;IntPtr top=GetAncestor(target,2);uint process;GetWindowThreadProcessId(top==IntPtr.Zero?target:top,out process);return process==(uint)parent;}
 IntPtr ObserveMouseEvent(int code,IntPtr message,IntPtr data){
  int kind=message.ToInt32();if(code>=0&&data!=IntPtr.Zero&&(kind==0x201||kind==0x204||kind==0x207||kind==0x20b)){
   // Resolve at mouse-down, before the click can change our UI. Coordinates never
   // leave this helper: the parent receives only an outside-click boolean.
   bool outside=!Protected(parentId,Marshal.ReadInt32(data),Marshal.ReadInt32(data,4));
   if(outside&&!closing)BeginInvoke((Action)(()=>Emit("outside-click","true")));
  }return CallNextHookEx(mouseHook,code,message,data);
 }
 void ObserveClicks(bool enabled){if(enabled&&mouseHook==IntPtr.Zero){mouseProc=ObserveMouseEvent;mouseHook=SetWindowsHookEx(14,mouseProc,GetModuleHandle(null),0);}if(!enabled&&mouseHook!=IntPtr.Zero){UnhookWindowsHookEx(mouseHook);mouseHook=IntPtr.Zero;}Emit("click-observer",enabled?(mouseHook!=IntPtr.Zero?"true":"false"):"false");}
 void Commands(){string line;try{while((line=Console.ReadLine())!=null){if(line=="observe:1"||line=="observe:0"){bool enabled=line=="observe:1";if(!closing)BeginInvoke((Action)(()=>ObserveClicks(enabled)));}}if(!closing)BeginInvoke((Action)(()=>Application.Exit()));}catch{}}
 static void Emit(string type,string value){Console.WriteLine("{\"type\":\""+type+"\",\"value\":"+value+"}");Console.Out.Flush();}
 static void Initial(){IntPtr b;int bytes;if(WTSQuerySessionInformation(IntPtr.Zero,Process.GetCurrentProcess().SessionId,25,out b,out bytes)){try{if(bytes>=20&&Marshal.ReadInt32(b)==1){int flags=Marshal.ReadInt32(b,16);if(flags==0||flags==1)Emit("lock",flags==0?"true":"false");}}finally{WTSFreeMemory(b);}}}
 public PresenceHelper(int parent){parentId=parent;ShowInTaskbar=false;Opacity=0;var handle=Handle;Guid g=new Guid("2b84c20e-ad23-4ddf-93db-05ffbd7efca5");notification=RegisterPowerSettingNotification(handle,ref g,0);bool session=WTSRegisterSessionNotification(handle,0);Emit("ready","{\"display\":"+(notification!=IntPtr.Zero?"true":"false")+",\"session\":"+(session?"true":"false")+"}");Initial();parentTimer.Interval=3000;parentTimer.Tick+=(s,e)=>{try{Process.GetProcessById(parent);}catch{Application.Exit();}};parentTimer.Start();new Thread(Commands){IsBackground=true}.Start();}
 protected override void SetVisibleCore(bool value){base.SetVisibleCore(false);}
 protected override void WndProc(ref Message m){if(m.Msg==0x2b1){if(m.WParam.ToInt32()==7)Emit("lock","true");if(m.WParam.ToInt32()==8)Emit("lock","false");}if(m.Msg==0x218&&m.WParam.ToInt32()==0x8013&&m.LParam!=IntPtr.Zero){Guid g=(Guid)Marshal.PtrToStructure(m.LParam,typeof(Guid));if(g==new Guid("2b84c20e-ad23-4ddf-93db-05ffbd7efca5")){int value=Marshal.ReadInt32(m.LParam,20);Emit("display","\""+(value==0?"off":value==1?"on":"dim")+"\"");}}base.WndProc(ref m);}
 protected override void Dispose(bool disposing){closing=true;if(mouseHook!=IntPtr.Zero){UnhookWindowsHookEx(mouseHook);mouseHook=IntPtr.Zero;}if(notification!=IntPtr.Zero)UnregisterPowerSettingNotification(notification);WTSUnRegisterSessionNotification(Handle);parentTimer.Dispose();base.Dispose(disposing);}
 [STAThread] static void Main(string[] args){try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}if(args.Length>0&&args[0]=="--snapshot"){Initial();return;}if(args.Length==4&&args[0]=="--hit-test"){Emit("protected-click",Protected(int.Parse(args[1]),int.Parse(args[2]),int.Parse(args[3]))?"true":"false");return;}Application.Run(new PresenceHelper(args.Length>0?int.Parse(args[0]):Process.GetCurrentProcess().Id));}
}
