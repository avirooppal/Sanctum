# Chat cancellation UI v1

One chat run may be active per mounted composer. Stop aborts that run's HTTP
request through the existing SanctumClient AbortSignal contract. Repeated Stop
is harmless. No automatic retry occurs. Late chunks cannot update the transcript.
Navigation and model changes remain disabled until the run settles. Unmount
aborts the run. A subsequent explicit Send creates a fresh cancellation context.

Cancellation is displayed as stopped, not as a gateway error. Partial text stays
visible in memory. The gateway's existing completed-stream-only persistence rule
is unchanged; a completion racing Stop may already be saved. This is not an undo
or a promise that Stop deletes saved turns. Other failures remain visible.

Verification: controller tests cover stalled reads, late chunks, overlapping
starts, repeated cancellation and recovery; browser testing uses the real local
engine, observes the aborted request, then completes another chat.
