using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;

namespace LatifTradersSetup
{
    public class SetupForm : Form
    {
        private ProgressBar progressBar;
        private Label statusLabel;
        private Label titleLabel;
        private Label subtitleLabel;
        private Button installButton;
        private Button cancelButton;
        private CheckBox launchCheckBox;
        private Panel headerPanel;
        private BackgroundWorker worker;
        private string installDir;

        public SetupForm()
        {
            InitializeComponent();
            installDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LatifTraders");
        }

        private void InitializeComponent()
        {
            this.Text = "Latif Traders POS - Setup Wizard";
            this.Size = new Size(520, 360);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(248, 250, 252);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            headerPanel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 80,
                BackColor = Color.FromArgb(15, 23, 42)
            };

            titleLabel = new Label
            {
                Text = "Latif Traders - POS & ERP System",
                Font = new Font("Segoe UI", 13F, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(20, 15),
                AutoSize = true
            };

            subtitleLabel = new Label
            {
                Text = "100% Free Offline Desktop POS Setup",
                Font = new Font("Segoe UI", 9F),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(22, 45),
                AutoSize = true
            };

            headerPanel.Controls.Add(titleLabel);
            headerPanel.Controls.Add(subtitleLabel);

            statusLabel = new Label
            {
                Text = "Click 'Install' to install Latif Traders on this computer.\nNo internet or server required. Runs 100% locally.",
                Location = new Point(25, 105),
                Size = new Size(460, 45),
                ForeColor = Color.FromArgb(51, 65, 85)
            };

            progressBar = new ProgressBar
            {
                Location = new Point(25, 165),
                Size = new Size(455, 24),
                Visible = false
            };

            launchCheckBox = new CheckBox
            {
                Text = "Launch Latif Traders POS when setup completes",
                Checked = true,
                Location = new Point(25, 205),
                AutoSize = true,
                ForeColor = Color.FromArgb(30, 41, 59)
            };

            installButton = new Button
            {
                Text = "Install",
                Size = new Size(110, 34),
                Location = new Point(260, 255),
                BackColor = Color.FromArgb(2, 132, 199),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            installButton.FlatAppearance.BorderSize = 0;
            installButton.Click += InstallButton_Click;

            cancelButton = new Button
            {
                Text = "Cancel",
                Size = new Size(95, 34),
                Location = new Point(385, 255),
                BackColor = Color.FromArgb(226, 232, 240),
                ForeColor = Color.FromArgb(30, 41, 59),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            cancelButton.FlatAppearance.BorderSize = 0;
            cancelButton.Click += (s, e) => this.Close();

            this.Controls.Add(headerPanel);
            this.Controls.Add(statusLabel);
            this.Controls.Add(progressBar);
            this.Controls.Add(launchCheckBox);
            this.Controls.Add(installButton);
            this.Controls.Add(cancelButton);

            worker = new BackgroundWorker();
            worker.WorkerReportsProgress = true;
            worker.DoWork += Worker_DoWork;
            worker.ProgressChanged += Worker_ProgressChanged;
            worker.RunWorkerCompleted += Worker_RunWorkerCompleted;
        }

        private void InstallButton_Click(object sender, EventArgs e)
        {
            if (installButton.Text == "Finish")
            {
                if (launchCheckBox.Checked)
                {
                    string exePath = Path.Combine(installDir, "LatifTraders.exe");
                    if (File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = installDir, UseShellExecute = true });
                    }
                }
                this.Close();
                return;
            }

            installButton.Enabled = false;
            cancelButton.Enabled = false;
            progressBar.Visible = true;
            progressBar.Style = ProgressBarStyle.Marquee;
            statusLabel.Text = "Extracting and installing files... Please wait.";

            worker.RunWorkerAsync();
        }

        private void Worker_DoWork(object sender, DoWorkEventArgs e)
        {
            if (!Directory.Exists(installDir))
            {
                Directory.CreateDirectory(installDir);
            }

            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream resourceStream = asm.GetManifestResourceStream("package.zip"))
            {
                if (resourceStream == null)
                {
                    throw new Exception("Embedded package files not found in installer.");
                }

                using (ZipArchive archive = new ZipArchive(resourceStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        string targetPath = Path.Combine(installDir, entry.FullName);

                        if (entry.FullName.EndsWith("/") || entry.FullName.EndsWith("\\"))
                        {
                            Directory.CreateDirectory(targetPath);
                            continue;
                        }

                        if (entry.FullName.Replace('\\', '/').Contains("data/latif_traders.db") && File.Exists(targetPath))
                        {
                            continue;
                        }

                        string parentDir = Path.GetDirectoryName(targetPath);
                        if (!Directory.Exists(parentDir))
                        {
                            Directory.CreateDirectory(parentDir);
                        }

                        entry.ExtractToFile(targetPath, true);
                    }
                }
            }

            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopPath, "Latif Traders POS.lnk");
                string targetExe = Path.Combine(installDir, "LatifTraders.exe");

                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetExe;
                    shortcut.WorkingDirectory = installDir;
                    shortcut.Description = "Latif Traders - POS & Frozen Food Management System";
                    shortcut.IconLocation = targetExe + ",0";
                    shortcut.Save();
                }
            }
            catch { }
        }

        private void Worker_ProgressChanged(object sender, ProgressChangedEventArgs e)
        {
        }

        private void Worker_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
        {
            progressBar.Visible = false;

            if (e.Error != null)
            {
                statusLabel.Text = "Installation error: " + e.Error.Message;
                statusLabel.ForeColor = Color.Red;
                cancelButton.Enabled = true;
            }
            else
            {
                statusLabel.Text = "Installation completed successfully!\nDesktop shortcut created: 'Latif Traders POS'";
                statusLabel.ForeColor = Color.FromArgb(16, 185, 129);
                installButton.Text = "Finish";
                installButton.Enabled = true;
                cancelButton.Visible = false;
            }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
