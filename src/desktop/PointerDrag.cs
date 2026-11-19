using System;
using System.Runtime.InteropServices;
using System.Threading;

internal static class PointerDrag {
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { internal int X; internal int Y; }

    [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);

    private static bool Down() { return (GetAsyncKeyState(1) & 0x8000) != 0; }

    private static void Main() {
        try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
        catch (EntryPointNotFoundException) { }
        Point previous = new Point { X = int.MinValue, Y = int.MinValue };
        while (Down()) {
            Point next;
            if (GetCursorPos(out next) && Down() && (next.X != previous.X || next.Y != previous.Y)) {
                Console.WriteLine("{0},{1}", next.X, next.Y);
                previous = next;
            }
            Thread.Sleep(8);
        }
        Console.WriteLine("up");
    }
}
