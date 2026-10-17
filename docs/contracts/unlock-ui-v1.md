# Unlock UI contract v1

Locked is the initial state. No workspace shell,history,settings,dashboard or
global command shortcuts until loadWorkspace authenticates and validates the
real runtime response. URL hashes cannot bypass this boundary. UI hiding is
not a substitute for API authorization,which remains unchanged.

One primary submit labeled Unlock. Password field accessible name Local access
key;visible label Access key. Enter submits;empty/whitespace/busy cannot submit.
On submit clear previous error,keep credential in React memory only,disable
duplicate submission and show Unlocking. Failed bootstrap returns to locked
with the safe userError message and a retry action;never automatic replay.

Review local setup is secondary and opens the existing real SetupWizard. It
does not create keys or provision models. Back returns to direct key entry.
A native details disclosure explains that startup prints a token-file PATH,
not necessarily the credential itself. No key in URL,logs,storage or notices.

Credentials are never server-rendered by the product. Component SSR tests use
only public test strings. Rendering arbitrary error text must escape HTML.
No upstream branding or absolute privacy copy outside the attribution resource.
Dedicated notices remain available after unlock. No new auth/API contract.

Iteration2 observation:health is read with ADR0080 bounds. The chip's timestamp
records when this browser read the response,not when the kernel test ran.
Failed/partial/malformed/oversize health removes passed state. Details explain
that the Ledger is unavailable. Error text is linked via aria-describedby and
aria-invalid. No workspace or credential is needed for the public health read.
