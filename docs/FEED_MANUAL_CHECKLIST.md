# Feed Pane Manual Verification Checklist (`FEED_MANUAL_CHECKLIST.md`)

Automated tests verify host policy, isolation flags, SSRF/loopback/private-IP blocking, consent gating, Offline mode, host-only egress ledger summaries, state machine, multi-workspace queue, rate limiting, and agent-blindness. Run this short manual checklist in the shipped `Sanctum.exe` to verify live Instagram & audio behavior on your machine:

1. **Opt-in & Consent**
   - Open right panel -> click **Feed** tab (or press `Ctrl+Shift+F`).
   - Confirm Feed Pane is **Off** by default and displays the privacy notice stating Instagram/Meta sees your activity as in any browser.
   - Check the consent box and enable Feed Pane via the trusted-channel confirmation.
2. **Real Site Login, Scroll & Audio**
   - Sign in to Instagram inside the Feed tab (note: Sanctum does not spoof UA or bypass 2FA/login challenges).
   - Scroll the feed and play a Reel with audible audio.
3. **Automatic Pause & Multi-Workspace Jump**
   - While audio is playing, trigger a tool approval (e.g. `create_file` or `run_command` in **Ask All** mode) in a second workspace.
   - Verify within ~150 ms: audio mutes immediately, the native feed hides and suspends (`TrySuspendAsync`), and the slot shows `"Sanctum needs you: Waiting for your approval (<tool>) (<workspace>)"`.
   - Click **Jump to `<workspace>`**, approve or deny the card, and verify the feed resumes playback cleanly.
4. **Airspace, Offline Mode & Clear Data**
   - Open the Workspace Switcher (`Ctrl+Shift+W`) or Search (`Ctrl+K`) while Feed is open; verify the dialog renders cleanly without being clipped by the native feed.
   - Toggle **Offline mode** ON in Settings -> Network activity; verify Feed Pane immediately suspends and shows the Offline block notice.
   - Open Settings -> Network activity -> verify `FeedPane` ledger entries show host names and byte summaries only (**zero URLs or paths**).
   - Click the trash icon (**Sign out and clear feed data**); verify `%APPDATA%\Sanctum\feed-profile` is removed and Instagram returns to signed-out state.
