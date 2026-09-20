using System;
using System.Diagnostics;
using System.IO;
using System.Net;
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
            string logFile = Path.Combine(appDir, "launcher.log");

            Action<string> Log = (msg) =>
            {
                try { File.AppendAllText(logFile, string.Format("[{0}] {1}\r\n", DateTime.Now.ToString("HH:mm:ss"), msg)); } catch { }
            };

            Log("Launcher started in: " + appDir);

            string nodePath = Path.Combine(appDir, "bin", "node.exe");
            if (!File.Exists(nodePath))
            {
                nodePath = "node";
            }
            Log("Node path: " + nodePath);

            string serverScript = Path.Combine(appDir, "server", "index.js");
            Log("Server script: " + serverScript);

            // Check if server is already responding
            bool running = CheckHealth();
            Log("Server initially running: " + running);

            if (!running)
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodePath,
                    Arguments = "\"" + serverScript + "\"",
                    WorkingDirectory = appDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                try
                {
                    Process p = Process.Start(psi);
                    Log("Started server PID: " + (p != null ? p.Id.ToString() : "null"));
                }
                catch (Exception ex)
                {
                    Log("Error starting server: " + ex.ToString());
                    MessageBox.Show("Failed to start server: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // Wait up to 10 seconds for server to be responsive
                for (int i = 0; i < 20; i++)
                {
                    Thread.Sleep(500);
                    if (CheckHealth())
                    {
                        running = true;
                        Log("Server became healthy after " + ((i + 1) * 500) + "ms");
                        break;
                    }
                }
            }

            if (!running)
            {
                Log("Server failed to become healthy within 10s");
                MessageBox.Show("Latif Traders server failed to start on http://localhost:5000.\nPlease check launcher.log for details.", "Server Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            // Open dedicated window
            OpenAppWindow(appDir, Log);
        }

        private static bool CheckHealth()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:5000/api/health");
                req.Timeout = 1000;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                {
                    return res.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void OpenAppWindow(string appDir, Action<string> Log)
        {
            string url = "http://127.0.0.1:5000";

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

            try
            {
                if (File.Exists(edgePath))
                {
                    Log("Opening with Edge: " + edgePath);
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = edgePath,
                        Arguments = "--app=\"" + url + "\" --window-size=1366,768",
                        UseShellExecute = true
                    });
                }
                else if (File.Exists(chromePath))
                {
                    Log("Opening with Chrome: " + chromePath);
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = chromePath,
                        Arguments = "--app=\"" + url + "\" --window-size=1366,768",
                        UseShellExecute = true
                    });
                }
                else
                {
                    Log("Opening with default browser: " + url);
                    Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                }
            }
            catch (Exception ex)
            {
                Log("Error opening browser: " + ex.ToString());
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
        }
    }
}