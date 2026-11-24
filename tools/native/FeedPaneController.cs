using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Sanctum.Harness;

namespace Sanctum {
    /// <summary>
    /// Part B2: Separate native WebView2 Feed Pane controller.
    /// Strict isolation: dedicated CoreWebView2Environment & %APPDATA%\Sanctum\feed-profile,
    /// zero WebMessage/host-object/script-injection bridge, deny-all permissions & downloads,
    /// preset allowlist + loopback/private-IP/DNS-rebinding block, lazy lifecycle & crash recovery.
    /// The agent and screenshot tools have ZERO access to this controller.
    /// </summary>
    public sealed class FeedPaneController : IDisposable {
        private readonly Form _hostForm;
        private readonly FeedHostService _service;
        private readonly Action<Keys> _onForwardShortcut;
        private readonly System.Windows.Forms.Timer _idleTimer;

        private WebView2 _webView;
        private CoreWebView2Environment _environment;
        private Rectangle _slotBounds = Rectangle.Empty;
        private bool _airspaceOccluded;
        private bool _pausedByAttention;
        private bool _isOpen;
        private bool _initializing;
        private DateTime _closedSinceUtc = DateTime.MinValue;

        public FeedPaneController(Form hostForm, FeedHostService service, Action<Keys> onForwardShortcut = null) {
            _hostForm = hostForm;
            _service = service;
            _onForwardShortcut = onForwardShortcut;
            _idleTimer = new System.Windows.Forms.Timer { Interval = 30000 };
            _idleTimer.Tick += (s, e) => CheckIdleDestroy();
            _idleTimer.Start();
        }

        public bool IsControlVisible => _webView != null && _webView.Visible;
        public Rectangle CurrentSlotBounds => _slotBounds;

        public async Task OpenAsync(string startUrl = null) {
            if (!_service.IsEffectiveEnabled) {
                HideAndSuspendAsync();
                return;
            }
            _isOpen = true;
            _closedSinceUtc = DateTime.MinValue;
            await EnsureInitializedAsync();
            if (_webView?.CoreWebView2 == null) return;

            UpdateControlVisibility();
            if (!string.IsNullOrWhiteSpace(startUrl)) {
                var check = _service.EvaluateRequest(startUrl);
                if (check.Allowed) {
                    _webView.CoreWebView2.Navigate(startUrl);
                }
            }
        }

        public void ClosePane() {
            _isOpen = false;
            _closedSinceUtc = DateTime.UtcNow;
            HideAndSuspendAsync();
        }

        public void SetSlotBounds(Rectangle clientRect) {
            _slotBounds = clientRect;
            if (_webView != null && !_webView.IsDisposed) {
                _webView.Bounds = clientRect;
                UpdateControlVisibility();
            }
        }

        public void SetAirspaceOccluded(bool occluded) {
            _airspaceOccluded = occluded;
            UpdateControlVisibility();
        }

        /// <summary>
        /// Temporarily hides the native feed HWND during any Sanctum screenshot capture so the feed
        /// is never visible to screenshot/attach-window features.
        /// </summary>
        public IDisposable TemporarilyHideForScreenshot() {
            bool wasVisible = _webView != null && !_webView.IsDisposed && _webView.Visible;
            if (wasVisible) _webView.Visible = false;
            return new ScreenshotRestoreHandle(() => {
                if (wasVisible && _webView != null && !_webView.IsDisposed) UpdateControlVisibility();
            });
        }

        private sealed class ScreenshotRestoreHandle : IDisposable {
            private readonly Action _restore;
            public ScreenshotRestoreHandle(Action restore) { _restore = restore; }
            public void Dispose() { try { _restore(); } catch { } }
        }

        public async Task<bool> PauseForAttentionAsync() {
            _pausedByAttention = true;
            if (_webView?.CoreWebView2 == null) return true;
            try {
                _webView.CoreWebView2.IsMuted = true;
                _webView.Visible = false;
                return await _webView.CoreWebView2.TrySuspendAsync();
            } catch {
                return false;
            }
        }

        public void ResumeFromAttention() {
            _pausedByAttention = false;
            if (_webView?.CoreWebView2 == null) return;
            try {
                _webView.CoreWebView2.Resume();
                _webView.CoreWebView2.IsMuted = false;
                UpdateControlVisibility();
            } catch { }
        }

        public async void HideAndSuspendAsync() {
            if (_webView == null || _webView.IsDisposed) return;
            try {
                if (_webView.CoreWebView2 != null) {
                    _webView.CoreWebView2.IsMuted = true;
                    _webView.Visible = false;
                    await _webView.CoreWebView2.TrySuspendAsync();
                } else {
                    _webView.Visible = false;
                }
            } catch { }
        }

        private void UpdateControlVisibility() {
            if (_webView == null || _webView.IsDisposed) return;
            bool shouldShow = _isOpen && _service.IsEffectiveEnabled && !_airspaceOccluded && !_pausedByAttention &&
                              _slotBounds.Width > 20 && _slotBounds.Height > 20;
            _webView.Visible = shouldShow;
            if (shouldShow) {
                _webView.Bounds = _slotBounds;
                _webView.BringToFront();
            }
        }

        private async Task EnsureInitializedAsync() {
            if (_webView != null && !_webView.IsDisposed && _webView.CoreWebView2 != null) return;
            if (_initializing) return;
            _initializing = true;
            try {
                Directory.CreateDirectory(_service.FeedProfileDir);
                var envOpts = new CoreWebView2EnvironmentOptions();
                _environment = await CoreWebView2Environment.CreateAsync(null, _service.FeedProfileDir, envOpts);

                _webView = new WebView2 {
                    Visible = false,
                    Bounds = _slotBounds.IsEmpty ? new Rectangle(0, 0, 360, 600) : _slotBounds
                };
                _hostForm.Controls.Add(_webView);

                if (_service.InPrivateMode) {
                    var ctrlOpts = _environment.CreateCoreWebView2ControllerOptions();
                    ctrlOpts.IsInPrivateModeEnabled = true;
                    await _webView.EnsureCoreWebView2Async(_environment, ctrlOpts);
                } else {
                    await _webView.EnsureCoreWebView2Async(_environment);
                }

                ConfigureHardenedCoreWebView(_webView.CoreWebView2);
                WireControllerEvents();
            } catch {
                // Feed failure must NEVER crash or block the main Sanctum window
                DestroyControl();
            } finally {
                _initializing = false;
            }
        }

        private void ConfigureHardenedCoreWebView(CoreWebView2 core) {
            // Strict zero-bridge, zero-telemetry hardening
            core.Settings.IsWebMessageEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultScriptDialogsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsReputationCheckingRequired = false;

            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);

            core.NavigationStarting += (s, e) => {
                var check = _service.EvaluateRequest(e.Uri);
                if (!check.Allowed) {
                    e.Cancel = true;
                    return;
                }
                _service.RecordHostTransfer(check.Host, 0);
            };

            core.WebResourceRequested += (s, e) => {
                var check = _service.EvaluateRequest(e.Request.Uri);
                if (!check.Allowed) {
                    e.Response = _environment.CreateWebResourceResponse(null, 403, "Blocked by Sanctum Feed Policy", "Content-Type: text/plain");
                    return;
                }
                _service.RecordHostTransfer(check.Host, 512);
            };

            core.PermissionRequested += (s, e) => {
                e.State = CoreWebView2PermissionState.Deny;
            };

            core.DownloadStarting += (s, e) => {
                e.Cancel = true;
            };

            core.NewWindowRequested += (s, e) => {
                e.Handled = true;
                var check = _service.EvaluateRequest(e.Uri);
                if (check.Allowed) {
                    core.Navigate(e.Uri);
                    return;
                }
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out var extUri) &&
                    string.Equals(extUri.Scheme, "https", StringComparison.OrdinalIgnoreCase) &&
                    !FeedHostService.IsPrivateOrLocalHost(extUri.Host)) {
                    var dr = MessageBox.Show(
                        $"Open external link in your system browser?\n\n{extUri.AbsoluteUri}",
                        "Sanctum Feed — External Link",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question);
                    if (dr == DialogResult.Yes) {
                        Process.Start(new ProcessStartInfo(extUri.AbsoluteUri) { UseShellExecute = true });
                    }
                }
            };

            core.ProcessFailed += (s, e) => {
                // Recover cleanly from renderer crash without affecting main Sanctum UI
                try {
                    _hostForm.BeginInvoke((Action)(() => {
                        DestroyControl();
                        if (_isOpen && _service.IsEffectiveEnabled) {
                            _ = OpenAsync();
                        }
                    }));
                } catch { }
            };
        }

        private void WireControllerEvents() {
            if (_webView == null) return;
            _webView.KeyDown += (s, e) => {
                if (e.Control && e.Shift && (e.KeyCode == Keys.F || e.KeyCode == Keys.W)) {
                    e.SuppressKeyPress = true;
                    _onForwardShortcut?.Invoke(e.KeyData);
                } else if (e.Control && (e.KeyCode == Keys.K || e.KeyCode == Keys.N)) {
                    e.SuppressKeyPress = true;
                    _onForwardShortcut?.Invoke(e.KeyData);
                }
            };
        }

        private void CheckIdleDestroy() {
            if (_isOpen || _webView == null || _closedSinceUtc == DateTime.MinValue) return;
            if ((DateTime.UtcNow - _closedSinceUtc).TotalMinutes >= _service.IdleDestroyMinutes) {
                DestroyControl();
            }
        }

        public void DestroyControl() {
            if (_webView != null) {
                try {
                    _hostForm.Controls.Remove(_webView);
                    _webView.Dispose();
                } catch { }
                _webView = null;
            }
        }

        public void Dispose() {
            _idleTimer.Stop();
            _idleTimer.Dispose();
            DestroyControl();
        }
    }
}
