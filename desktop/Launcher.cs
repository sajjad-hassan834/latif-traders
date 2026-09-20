using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace LatifTraders
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = Path.Combine(appDir, "bin", "node.exe");
            if (!File.Exists(nodePath))
            {
                nodePath = "node";
            }

            string serverScript = Path.Combine(appDir, "server", "index.js");

            ProcessStartInfo serverPsi = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + serverScript + "\"",
                WorkingDirectory = appDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            Process serverProcess = null;
            try
            {
                serverProcess = Process.Start(serverPsi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not start Latif Traders server: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            AppDomain.CurrentDomain.ProcessExit += (s, e) =>
            {
                try { if (serverProcess != null && !serverProcess.HasExited) serverProcess.Kill(); } catch { }
            };

            Thread.Sleep(1500);

            string edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
            if (!File.Exists(edgePath))
            {
                edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe");
            }

            string chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe");
            if (!File.Exists(chromePath))
            {
                chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe");
            }

            string targetUrl = "http://localhost:5000";
            Process browserProcess = null;

            if (File.Exists(edgePath))
            {
                browserProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = edgePath,
                    Arguments = "--app=\"" + targetUrl + "\" --window-size=1366,768",
                    UseShellExecute = true
                });
            }
            else if (File.Exists(chromePath))
            {
                browserProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = chromePath,
                    Arguments = "--app=\"" + targetUrl + "\" --window-size=1366,768",
                    UseShellExecute = true
                });
            }
            else
            {
                browserProcess = Process.Start(new ProcessStartInfo(targetUrl) { UseShellExecute = true });
            }

            if (browserProcess != null)
            {
                browserProcess.WaitForExit();
            }

            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                }
            }
            catch { }
        }
    }
}