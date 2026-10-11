# Web primitives v1

Native React Button, Input, Card and Dialog; no dependency on Electron, Portal,
remote assets or the upstream package. Button defaults to type=button; submit is
explicit. Disabled remains a native disabled control. Dialog uses showModal and
native inert/focus/escape behavior, with a labeled heading and explicit close.
Titles, labels and children remain React text; never dangerouslySetInnerHTML.

Styles use semantic primary/secondary/tertiary/disabled/on-accent text tokens.
Readable copy is at least12px; no opacity below0.7 or stacked text opacity.
Component font tiers, not shell-wide brand fonts. Reduced motion removes motion.
No fake backend controls. Licenses dialog contains the exact bundled notices.

Tests first: default/submit/disabled button semantics, input labels, text escaping,
dialog labels/native lifecycle. Run the actual browser keyboard/close/focus check
before claiming interactive accessibility. Full axe/theme/fidelity gates remain U5.
