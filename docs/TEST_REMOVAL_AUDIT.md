# Retired test and smoke audit — ADR0085/0087

Compared archived checkpoint625e48e706d431d546474e2ee9c9f71d7baea127 with
09c9b3d02b6de599791e7e4708b98e0175631402, then applied the A2 restoration.
All removed file hashes are in legacy-ui-removal.json; archive Git blobs remain.
Current real gateway evidence: a1-start-smoke-ui-salvage.json proves404 for /,
/index.html,/website.html,/docs.html and missing assets, plus health200/API401.

## Count reconciliation

| Suite | Before | Removed | Added | After retirement | Follow-up |
|---|---:|---:|---:|---:|---|
| Python source |187|4|0|183|A1 adds5 measurement contracts →188; retained backend tests unchanged |
| Web |95 (93 app tests+2 raster tests)|53|3 retirement tests|45|A3 removes11 dead-audio-helper tests →34 |
| Real smoke |19|12 old UI stages|1 real retirement/renderer stage|8|A2 restores HTTP assertions as1 stage →9 |

Two old dependency-boundary tests were replaced by renamed tests. Their original
forbidden package set and devDependency coverage had been narrowed; A2 restores
those assertions. Sessions HTTP401/400/404/413 and profile HTTP CRUD were also
lost inside deleted browser tests; A2 restores them in retained_state_http.py,
with real chat/history/rename/search/delete. These gaps are not labelled lossless.
Rust store contracts already remained; read-only journey readiness alone was not
a substitute for HTTP mutation/boundary tests. Other deleted browser assertions
concern absent UI, removed media controls or reference mocks. Real SDK inference,
RAG, file speech, ticket admission, purge and kernel/cancellation gates remain.

## Every removed source test

| Name | Covered feature | Retirement evidence |
|---|---|---|
| `test_records_candidates_and_exact_asset_hash` | Reference UI inventory admission | `tools/ui_inventory.py` removed; new product does not consume the reference environment |
| `test_dependency_versions_and_out_of_scope_files` | Reference UI inventory admission | `tools/ui_inventory.py` removed; new product does not consume the reference environment |
| `test_rejects_path_escape_and_mismatched_pin` | Reference UI inventory admission | `tools/ui_inventory.py` removed; new product does not consume the reference environment |
| `test_public_status_drift_fails` | Public HTML workflow-status projection | Both HTML entries removed/404; public_status/write_public_status removed; journey budgets/IDs still checked |

## Every removed web test

| Test name | Covered feature | Gone/replacement evidence |
|---|---|---|
| ContextBar renders truthful Unknown state when token usage data is missing | Retired chat-ui UI | `apps/web/src/ui/ChatView.tsx` removed; legacy app routes404 |
| ChatComposer lists ONLY implemented slash commands and no speculative commands | Retired chat-ui UI | `apps/web/src/ui/ChatView.tsx` removed; legacy app routes404 |
| ChatComposer renders accessible textarea with configurable Enter hint | Retired chat-ui UI | `apps/web/src/ui/ChatView.tsx` removed; legacy app routes404 |
| ChatView renders document measure layout and user bubbles layout without throwing | Retired chat-ui UI | `apps/web/src/ui/ChatView.tsx` removed; legacy app routes404 |
| ChatView renders calm streaming indicator during local generation | Retired chat-ui UI | `apps/web/src/ui/ChatView.tsx` removed; legacy app routes404 |
| DashboardPanel renders daemon health and dispatch lanes without throwing | Retired dashboard UI | `apps/web/src/DashboardPanel.tsx` removed; legacy app routes404 |
| focused-chat-composer keeps a compact writing surface | Retired focused-chat UI | `apps/web/src/ui/ChatComposer.tsx` removed; legacy app routes404 |
| focused-chat-stop replaces send during a request | Retired focused-chat UI | `apps/web/src/ui/ChatComposer.tsx` removed; legacy app routes404 |
| focused-chat-status discloses detailed diagnostics on demand | Retired focused-chat UI | `apps/web/src/ui/ChatComposer.tsx` removed; legacy app routes404 |
| badge distinguishes report time from test time and rejects incomplete health | Retired health-observation UI | `apps/web/src/ui/StartupBadge.tsx` removed; legacy app routes404 |
| landing-loop-fade follows500ms fades and100ms restart | Retired landing-loop UI | `apps/web/src/landing/video-loop.ts` removed; legacy app routes404 |
| landing-loop-cleanup cancels frames,timers and listeners | Retired landing-loop UI | `apps/web/src/landing/video-loop.ts` removed; legacy app routes404 |
| landing loop play rejection stays black without an unhandled retry | Retired landing-loop UI | `apps/web/src/landing/video-loop.ts` removed; legacy app routes404 |
| PanelRegistry registers dummy panel and enforces capabilities filter | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| Custom theme validation accepts compliant JSON and rejects hostile or malformed tokens | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| Contrast guard enforces WCAG AA contrast ratio and auto-adjusts failing colors | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| Preferences sanitizer migrates valid settings and recovers safely from corrupted data | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| PanelErrorBoundary catches render failures and renders accessible alert | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| Centralized string table contains required top-level categories and non-empty strings | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| Layout engine presets and keyboard shortcuts match ADR 0069 specification | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| SettingsModal renders with all A7 specification tabs without throwing | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| DashboardPage renders routed Hermes-mirrored pages without throwing | Retired modular-ui UI | `apps/web/src/ui/Customization.ts` removed; legacy app routes404 |
| native button defaults to non-submit, preserves explicit submit and disabled | Retired primitives UI | `apps/web/src/ui/primitives.tsx` removed; legacy app routes404 |
| untrusted titles and field text remain escaped React text | Retired primitives UI | `apps/web/src/ui/primitives.tsx` removed; legacy app routes404 |
| dialog has a named native modal and escaped children without an injected close link | Retired primitives UI | `apps/web/src/ui/primitives.tsx` removed; legacy app routes404 |
| shell has one sidebar and main with explicitly connected native navigation control | Retired primitives UI | `apps/web/src/ui/primitives.tsx` removed; legacy app routes404 |
| primitives CSS enforces 180ms motion and 44px coarse pointer touch target | Retired primitives UI | `apps/web/src/ui/primitives.tsx` removed; legacy app routes404 |
| apps/web production package.json does not import upstream or reference dependencies | Retained dependency/import boundary | Full package/devDependency/import assertions restored in retirement.test.mjs; reference environment removed |
| production web source code contains zero imports from reference or upstream directories | Retained dependency/import boundary | Full package/devDependency/import assertions restored in retirement.test.mjs; reference environment removed |
| RightRail returns null when isOpen is false | Retired right-rail UI | `apps/web/src/ui/RightRail.tsx` removed; legacy app routes404 |
| RightRail extracts code artifacts with language, lines, copy and download actions | Retired right-rail UI | `apps/web/src/ui/RightRail.tsx` removed; legacy app routes404 |
| RightRail extracts citations and safe links | Retired right-rail UI | `apps/web/src/ui/RightRail.tsx` removed; legacy app routes404 |
| RightRail renders accessible Knowledge tree header and empty state | Retired right-rail UI | `apps/web/src/ui/RightRail.tsx` removed; legacy app routes404 |
| StatusBar renders health, offline egress badge, and context bar | Retired status-bar UI | `apps/web/src/ui/StatusBar.tsx` removed; legacy app routes404 |
| StatusBar renders background jobs counter button | Retired status-bar UI | `apps/web/src/ui/StatusBar.tsx` removed; legacy app routes404 |
| core compiler preserves responsive and arbitrary-value application utilities | Retired styles UI | `apps/web/src/styles.css` removed; legacy app routes404 |
| TabRail renders accessible tablist, active tab, and close button | Retired tab-quad UI | `apps/web/src/ui/TabRail.tsx` removed; legacy app routes404 |
| QuadView renders four independent panes and clear waiting state under admission limits | Retired tab-quad UI | `apps/web/src/ui/TabRail.tsx` removed; legacy app routes404 |
| all pinned desktop and dashboard-only presets are available without upstream branding | Retired themes UI | `apps/web/src/ui/themes.ts` removed; legacy app routes404 |
| pinned canonical palette values and mode pairs are retained | Retired themes UI | `apps/web/src/ui/themes.ts` removed; legacy app routes404 |
| invalid IDs fail, tokens do not leak mutable palette references or remote URLs | Retired themes UI | `apps/web/src/ui/themes.ts` removed; legacy app routes404 |
| locked screen has one primary action and no workspace chrome | Retired unlock UI | `apps/web/src/ui/UnlockScreen.tsx` removed; legacy app routes404 |
| busy and blank keys disable submission;untrusted errors remain text | Retired unlock UI | `apps/web/src/ui/UnlockScreen.tsx` removed; legacy app routes404 |
| setup review is isolated from workspace and has a secondary back action | Retired unlock UI | `apps/web/src/ui/UnlockScreen.tsx` removed; legacy app routes404 |
| custom accent recomputes foreground instead of inheriting white label ink | Retired unlock UI | `apps/web/src/ui/UnlockScreen.tsx` removed; legacy app routes404 |
| public website is offline, branded Sanctum, with honest setup links | Retired website UI | `apps/web/website.html` removed; legacy app routes404 |
| docs site is offline, branded Sanctum, with local navigation and zero scripts/images | Retired website UI | `apps/web/website.html` removed; legacy app routes404 |
| platform-status section reads only verified artifacts and fails if it disagrees with RELEASE_CHECKLIST.md | Retired website UI | `apps/web/website.html` removed; legacy app routes404 |
| platform comparison is independent of checklist row order and later rows | Retired website UI | `apps/web/website.html` removed; legacy app routes404 |
| setup cannot fabricate hardware, model verification or an owner key | Retired workflow-ui UI | `apps/web/src/SetupWizard.tsx` removed; legacy app routes404 |
| unregistered preference themes recover to an admitted local preset | Retired workflow-ui UI | `apps/web/src/SetupWizard.tsx` removed; legacy app routes404 |
| identical raster is zero and multiple changed channels count one pixel | Pixel-difference calculation | evals/ui_font_metrics.mjs removed with font/fidelity gates |
| unequal, empty and malformed raster inputs fail | Pixel-difference calculation | evals/ui_font_metrics.mjs removed with font/fidelity gates |

## Every removed smoke stage

| Stage | Covered feature | Gone/replacement evidence |
|---|---|---|
| `ui` | Speech controls and old unlock shell | Old app sources removed; / returns404 |
| `ui_knowledge` | Knowledge dialog | Old app sources removed; / returns404 |
| `ui_chat_stop` | Old Stop button lifecycle | Old app sources removed; / returns404 |
| `ui_sessions` | Conversation sidebar/rename/delete dialogs plus HTTP boundary checks | Old app sources removed; / returns404; retained HTTP contracts restored in retained_state_http.py |
| `ui_workflow` | Setup/preferences/dashboard UI | Old app sources removed; / returns404 |
| `ui_dashboard_profiles` | Dashboard/profile dialogs plus HTTP CRUD | Old app sources removed; / returns404; retained HTTP contracts restored in retained_state_http.py |
| `ui_website` | Public website and docs routes | website.html/docs.html removed; both routes404 |
| `ui_fidelity` | Old geometry/themes/fidelity | Old app sources removed; / returns404 |
| `ui_unlock` | Unlock layout/contrast/focus | Old app sources removed; / returns404 |
| `ui_shell` | Sidebar/navigation/disclosure layout | Old app sources removed; / returns404 |
| `ui_theme_controls` | Theme/mode controls | Old app sources removed; / returns404 |
| `ui_focused_chat` | Old compact chat layout | Old app sources removed; / returns404 |

## Additional removed browser scripts (outside the19-stage default)

| Script | Covered feature | Gone/replacement evidence |
|---|---|---|
| `browser_adapter.mjs` | Old browser adapter integration; API/SSE/ticket contracts retained in api.test.mjs and SDK/ticket smoke | Script absent, archived Git source retained; no new UI acceptance claim |
| `browser_e2e_suite.mjs` | Mock-gateway UI tour; mocks and all toured shell sources removed | Script absent, archived Git source retained; no new UI acceptance claim |
| `browser_fonts.mjs` | Bundled font loading and theme layout; font assets/styles removed | Script absent, archived Git source retained; no new UI acceptance claim |
| `browser_licenses.mjs` | Old license dialog/focus; dialog source removed, actual package license gates remain | Script absent, archived Git source retained; no new UI acceptance claim |
| `browser_meeting.mjs` | Old meeting controls; controls removed, helper removed by A3; backend meeting tests remain | Script absent, archived Git source retained; no new UI acceptance claim |
| `browser_microphone.mjs` | Old microphone controls; controls removed, helper/worklet removed by A3; backend speech tests remain | Script absent, archived Git source retained; no new UI acceptance claim |
| `browser_zoom.mjs` | Old shell at200% browser zoom; shell removed; new M3 accessibility remains pending | Script absent, archived Git source retained; no new UI acceptance claim |

## Follow-up coverage boundary

No retained backend test file is removed by A2/A3. The restored HTTP stage must
pass against the real gateway before this audit is marked verified. Removed UI
accessibility/layout tests do not certify the future desktop. A3 audio helpers and
their11 deleted tests are individually listed in UI_MODULE_RETENTION.md.
