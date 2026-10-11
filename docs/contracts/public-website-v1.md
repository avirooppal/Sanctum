# Public website v1

GET /website.html serves a static, unauthenticated product overview in the
existing gateway asset directory. GET / retains the application contract.
The site exposes no credentials, drafts, storage or mutation API. It must not
fetch a third-party resource or establish a WebSocket. All navigation targets
are local page anchors or the real application root. Existing CSP is unchanged.

Content must distinguish working development features from unfinished release
requirements. Windows EXE, Linux packages, full duplex voice, vision and agents
cannot be advertised as available until their release evidence exists.
No upstream brand assets or remote fonts. Native details/summary FAQ controls
work without JavaScript. Keyboard focus and no horizontal overflow are checked
at 1440x900, 820x1180 and 390x844. This is functional coverage, not fidelity.
