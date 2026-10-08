import errno
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "isolated_run", Path(__file__).parents[1] / "isolated_run.py"
)
isolation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(isolation)


class IsolationTests(unittest.TestCase):
    def test_connection_refusal_is_not_denial(self):
        with patch.object(isolation.socket, "socket") as sock:
            sock.return_value.__enter__.return_value.connect.side_effect = OSError(
                errno.ECONNREFUSED, "refused"
            )
            with self.assertRaises(RuntimeError):
                isolation.probe(
                    isolation.socket.AF_INET, isolation.socket.SOCK_STREAM, ("192.0.2.1", 443)
                )

    def test_rejects_host_interfaces_before_probing(self):
        with (
            patch.object(isolation.socket, "if_nameindex", return_value=[(1, "lo"), (2, "eth0")]),
            patch.object(isolation.socket, "socket") as sock,
        ):
            with self.assertRaises(RuntimeError):
                isolation.self_test()
            sock.assert_not_called()

    def test_timeout_is_not_evidence_of_denial(self):
        with patch.object(isolation.socket, "socket") as sock:
            sock.return_value.__enter__.return_value.connect.side_effect = TimeoutError()
            with self.assertRaises(RuntimeError):
                isolation.probe(
                    isolation.socket.AF_INET, isolation.socket.SOCK_STREAM, ("192.0.2.1", 443)
                )

    def test_kernel_no_route_is_denial(self):
        with patch.object(isolation.socket, "socket") as sock:
            sock.return_value.__enter__.return_value.connect.side_effect = OSError(
                errno.ENETUNREACH, "no route"
            )
            isolation.probe(
                isolation.socket.AF_INET, isolation.socket.SOCK_STREAM, ("192.0.2.1", 443)
            )

    def test_successful_connection_fails_gate(self):
        with patch.object(isolation.socket, "socket"):
            with self.assertRaises(RuntimeError):
                isolation.probe(
                    isolation.socket.AF_INET, isolation.socket.SOCK_STREAM, ("192.0.2.1", 443)
                )
