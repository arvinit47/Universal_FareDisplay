import tempfile
import time
import unittest
from pathlib import Path

from pi_display.config import load_config
from pi_display.protocol import FrameStream
from pi_display.state import FareState


class FareStateTests(unittest.TestCase):
    def setUp(self):
        self.settings = {
            "operator": "RAMESH CHANDRA",
            "terminal": "PNBE0101",
            "windowNo": "12",
            "shiftNo": "2",
            "station": "PATNA JN",
            "zone": "EAST CENTRAL RAILWAY",
        }
        self.state = FareState(self.settings)

    def test_session_initialized_from_settings(self):
        self.assertEqual(self.state.values["operator"], "RAMESH CHANDRA")
        self.assertEqual(self.state.values["terminal"], "PNBE0101")
        self.assertEqual(self.state.values["window"], "12")
        self.assertEqual(self.state.values["shift"], "2")
        self.assertEqual(self.state.values["station"], "PATNA JN")
        self.assertEqual(self.state.values["zone"], "EAST CENTRAL RAILWAY")

    def test_clear_ticket_preserves_operator_session(self):
        # Feed ticket data
        stream = FrameStream()
        msgs = stream.feed(
            "$0126NDLS:NEW DELHI:नई दिल्ली:^"
            "$0805120:^"
            "$05021:^"
            "$06022:^"
        )
        for msg in msgs:
            self.state.apply_message(msg)

        self.assertEqual(self.state.values["source"], "NEW DELHI (NDLS)")
        self.assertEqual(self.state.values["fare"], "120")
        self.assertEqual(self.state.values["adult"], "1")
        self.assertEqual(self.state.values["child"], "2")

        # Clear ticket
        self.state.clear_ticket()

        # Passenger fields cleared
        self.assertEqual(self.state.values["source"], "")
        self.assertEqual(self.state.values["fare"], "")
        self.assertEqual(self.state.values["adult"], "")
        self.assertEqual(self.state.values["child"], "")

        # Operator counter session MUST be preserved!
        self.assertEqual(self.state.values["operator"], "RAMESH CHANDRA")
        self.assertEqual(self.state.values["terminal"], "PNBE0101")
        self.assertEqual(self.state.values["window"], "12")
        self.assertEqual(self.state.values["shift"], "2")

    def test_bilingual_station_handling(self):
        stream = FrameStream()
        msg = stream.feed("$0126DLI:OLD DELHI:पुरानी दिल्ली:^")[0]
        self.state.apply_message(msg)
        self.assertEqual(self.state.values["source"], "OLD DELHI (DLI)")
        self.assertEqual(self.state.values["source_hin"], "पुरानी दिल्ली")
        self.assertEqual(self.state.route_from, "DLI")

    def test_date_and_month_zero_padded(self):
        stream = FrameStream()
        msgs = stream.feed("$03405:^$040409:^")
        for m in msgs:
            self.state.apply_message(m)
        self.assertEqual(self.state.values["date"], "05/09")

    def test_via_route_accumulation(self):
        stream = FrameStream()
        msgs = stream.feed(
            "$1724CNB:KANPUR:कानपुर:^"
            "$1824ALD:PRAYAGRAJ:प्रयागराज:^"
        )
        for m in msgs:
            self.state.apply_message(m)
        self.assertEqual(self.state.values["via"], "CNB - ALD")

    def test_cancellation_and_refund_flow(self):
        stream = FrameStream()
        msg = stream.feed("$1425CANC:DIGITAL:850:^")[0]
        self.state.apply_message(msg)
        self.assertEqual(self.state.values["refund"], "850")
        self.assertIn("CANCELLATION", self.state.values["transaction_type"])
        self.assertIn("DIGITAL", self.state.values["transaction_type"])
        self.assertEqual(self.state.values["fare"], "850 (REFUND)")

    def test_operator_update_persists_to_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cfg_path = Path(temp_dir) / "config.json"
            cfg_path.write_text("{}", encoding="utf-8")

            stream = FrameStream()
            msg = stream.feed("$1531ANITA VERMA:PNBE0202:14:1:^")[0]
            self.state.apply_message(msg, config_path=cfg_path, persist_operator=True)

            self.assertEqual(self.state.values["operator"], "ANITA VERMA")
            self.assertEqual(self.state.values["terminal"], "PNBE0202")
            self.assertEqual(self.state.values["window"], "14")
            self.assertEqual(self.state.values["shift"], "1")

            saved = load_config(cfg_path)
            self.assertEqual(saved["operator"], "ANITA VERMA")
            self.assertEqual(saved["terminal"], "PNBE0202")

    def test_auto_clear_timeout_behavior(self):
        self.assertFalse(self.state.should_auto_clear(0))
        # No active ticket
        self.assertFalse(self.state.should_auto_clear(1))
        # Add fare
        self.state.values["fare"] = "250"
        self.state.last_activity = time.monotonic() - 10
        self.assertTrue(self.state.should_auto_clear(5))
        self.assertFalse(self.state.should_auto_clear(20))


if __name__ == "__main__":
    unittest.main()

