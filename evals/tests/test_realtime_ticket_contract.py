import json
import unittest
from pathlib import Path

import jsonschema


class RealtimeTicketContractTests(unittest.TestCase):
    def test_credential_contract_is_bounded_and_authenticated(self):
        root = Path(__file__).resolve().parents[2]
        spec = json.loads((root / "docs/contracts/realtime-ticket.openapi.json").read_text())
        post = spec["paths"]["/v1/realtime/tickets"]["post"]
        self.assertEqual(post["security"], [{"localOwner": []}])
        schema = post["responses"]["200"]["content"]["application/json"]["schema"]
        jsonschema.validate(
            {"ticket": "a" * 64, "expires_in": 30, "protocol": "sanctum.realtime.v1"}, schema
        )
        for ticket in ["a" * 65, "g" * 64, "token-in-url"]:
            with self.assertRaises(jsonschema.ValidationError):
                jsonschema.validate(
                    {"ticket": ticket, "expires_in": 30, "protocol": "sanctum.realtime.v1"}, schema
                )
