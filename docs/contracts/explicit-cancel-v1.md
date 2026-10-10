# Explicit owner cancellation v1

POST /v1/cancel, Authorization: Bearer <local owner token>, Content-Length: 0.
Success 200 JSON {cancelled: nonnegative integer, reason: "explicit"}. Invalid token
401; authenticated non-POST 405; non-empty body rejected by ingress. Count means
engine contexts targeted, including pending admitted jobs; a racing earlier reason
is not overwritten. Control lane remains operational. Cancellation reaches the
existing request contexts and supervised jobs; no new egress or privilege.
