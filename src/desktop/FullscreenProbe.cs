using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class FullscreenProbe
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Rect { internal int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct Monitor
    {
        internal int Size;
        internal Rect Bounds, Work;
        internal uint Flags;
    }

    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint relation);
    [DllImport("user32.dll", EntryPoint="GetWindowLongW")]
    private static extern int GetWindowStyle(IntPtr window, int index);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref Monitor info);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out int process);
    [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out Rect rect, int size);
    [DllImport("dwmapi.dll", EntryPoint="DwmGetWindowAttribute")]
    private static extern int DwmGetWindowFlag(IntPtr window, int attribute, out int value, int size);

    private const int Layered = 0x00080000;
    private const int Transparent = 0x00000020;
    private const int ToolWindow = 0x00000080;
    private const int NoActivate = 0x08000000;
    private static readonly string[] CaptureProcesses = {
        "SnippingTool", "ScreenClippingHost", "ScreenSketch", "PixPin", "Snipaste",
        "ShareX", "Flameshot", "NVIDIA Overlay", "NVIDIA Share"
    };

    private static bool IsCaptureWindow(IntPtr window, int processId)
    {
        int style = GetWindowStyle(window, -20);
        if ((style & (Layered | Transparent | ToolWindow | NoActivate)) != 0) return true;
        var buffer = new StringBuilder(256);
        GetClassName(window, buffer, buffer.Capacity);
        string windowClass = buffer.ToString();
        if (windowClass.IndexOf("Capture", StringComparison.OrdinalIgnoreCase) >= 0 ||
            windowClass.IndexOf("ScreenClip", StringComparison.OrdinalIgnoreCase) >= 0) return true;
        try
        {
            using (var process = Process.GetProcessById(processId))
                return Array.Exists(CaptureProcesses, name =>
                    String.Equals(name, process.ProcessName, StringComparison.OrdinalIgnoreCase));
        }
        catch (ArgumentException) { return true; }
    }

    private static IntPtr Fullscreen(int ownerId)
    {
        IntPtr window = GetForegroundWindow();
        if (window == IntPtr.Zero || window == GetShellWindow() || window == GetDesktopWindow() ||
            !IsWindowVisible(window) || IsIconic(window) || GetWindow(window, 4) != IntPtr.Zero)
            return IntPtr.Zero;
        int processId;
        if (GetWindowThreadProcessId(window, out processId) == 0 || processId == ownerId)
            return IntPtr.Zero;
        Rect rect;
        if (DwmGetWindowAttribute(window, 9, out rect, Marshal.SizeOf(typeof(Rect))) != 0 &&
            !GetWindowRect(window, out rect)) return IntPtr.Zero;
        var monitor = new Monitor { Size = Marshal.SizeOf(typeof(Monitor)) };
        if (!GetMonitorInfo(MonitorFromWindow(window, 2), ref monitor)) return IntPtr.Zero;
        const int tolerance = 2;
        Rect bounds = monitor.Bounds;
        if (Math.Abs(rect.Left-bounds.Left)>tolerance || Math.Abs(rect.Top-bounds.Top)>tolerance ||
            Math.Abs(rect.Right-bounds.Right)>tolerance || Math.Abs(rect.Bottom-bounds.Bottom)>tolerance)
            return IntPtr.Zero;
        int cloaked;
        if (DwmGetWindowFlag(window, 14, out cloaked, sizeof(int)) == 0 && cloaked != 0)
            return IntPtr.Zero;
        return IsCaptureWindow(window, processId) ? IntPtr.Zero : window;
    }

    private static void Main(string[] args)
    {
        int ownerId;
        if (args.Length != 1 || !Int32.TryParse(args[0], out ownerId)) return;
        SetProcessDPIAware();
        using (Process owner = Process.GetProcessById(ownerId))
        {
            IntPtr previous = IntPtr.Zero;
            int confirmations = 0;
            bool hidden = false;
            Console.WriteLine("0");
            while (!owner.HasExited)
            {
                IntPtr candidate = Fullscreen(ownerId);
                confirmations = candidate == previous ? Math.Min(confirmations+1,5) : 1;
                previous = candidate;
                bool next = candidate != IntPtr.Zero && confirmations >= 5;
                if (next != hidden)
                {
                    hidden = next;
                    Console.WriteLine(hidden ? "1" : "0");
                }
                Thread.Sleep(100);
            }
        }
    }
}
