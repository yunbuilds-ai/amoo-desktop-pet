using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Amoo Desktop Pet")]
[assembly: AssemblyProduct("Amoo Desktop Pet")]
[assembly: AssemblyDescription("Amoo 桌宠")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyInformationalVersion("1.0.0-rc.1 Community Preview")]

internal static class CompanionLauncher
{
    private const string Title = "Amoo 桌宠 · Amoo Desktop Pet";

    [STAThread]
    private static void Main()
    {
        var root = AppDomain.CurrentDomain.BaseDirectory;
        var binary = Path.Combine(root, "electron", "electron.exe");
        var desktop = Path.Combine(root, "src", "desktop");
        if (!File.Exists(binary) || !File.Exists(Path.Combine(desktop, "main.cjs")))
        {
            MessageBox.Show("Extract the complete portable folder before launching.", Title);
            return;
        }
        var cache = Path.Combine(root, "cache");
        Directory.CreateDirectory(cache);
        var start = new ProcessStartInfo(binary, "\"" + desktop + "\"")
        {
            WorkingDirectory = root,
            UseShellExecute = false
        };
        start.EnvironmentVariables["TEMP"] = cache;
        start.EnvironmentVariables["TMP"] = cache;
        try { Process.Start(start); }
        catch (Exception error) { MessageBox.Show(error.Message, Title); }
    }
}
