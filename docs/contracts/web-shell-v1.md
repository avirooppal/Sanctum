# Web shell v1

Desktop rail237px, docked at640px and wider, as pinned desktop layout constants.
Below640px the same sidebar becomes an explicit navigation drawer, initially
closed. Never duplicate sidebar state/controllers. Keyboard opener, named dialog,
inert background, Escape/close and focus return. Trap Tab within the open drawer.
No unsupported navigation destinations or mock backend screens.

Root occupies100dvh with bounded independent history/transcript scrolling; login
fits the initial viewport. Header, composer and existing file speech/meeting flows
remain usable. Brand fonts remain per component. All existing APIs/contracts and
functionality stay intact; layout-only changes require existing browser flows.

Actual browser assertions at1440x900/820x1180/390x844:237px dock,640px breakpoint,
mobile closed/open/Escape/focus/inert states,1CSS-pixel geometry tolerance, login
within viewport, no horizontal/document growth. Preserve prior screenshots and
failures. Whole upstream fidelity/axe still separate U5 gates.
