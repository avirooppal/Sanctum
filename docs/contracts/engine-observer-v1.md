# Evaluation engine observer v1

Evaluation-only JSONL observer joins the selected owner gateway's private user/network
namespace using nsenter --preserve-credentials. It reads validated numeric ports
from the runtime config, accepts only configured role names, and performs bounded
read-only GET /slots requests without proxies or redirects. Input lines <=256 bytes,
responses <=64KiB. Output {active: nonnegative integer}; model/request content is
never returned. The host harness owns/reaps the observer. This adds no product
route or egress permission and requires Linux namespace ownership. A missing or
failed observer marks compute-stop evidence unverified, never idle.
