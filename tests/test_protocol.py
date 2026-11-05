import tempfile
import unittest
from pathlib import Path

from pi_display.config import DEFAULTS, load_config, save_config
from pi_display.protocol import TRAIN_TYPES, TRANSACTION_TYPES, FrameStream, parse_frame


class ProtocolTests(unittest.TestCase):
    def test_existing_sample_frames_are_parsed(self):
        stream = FrameStream()
        messages = stream.feed(
            "$0126NDLS:NEW DELHI:NEW DELHI:^"
            "$0226HYD:HYDERABAD:HYDERABAD:^"
            "$03406:^$040412:^$050460:^$060404:^$0703S:^"
            "$080745604:^$0904II:^$1205BPT:^"
            "$1531SHASHI KUMAR:ABCDEF9999:350:9:^"
            "$2118phonepaytest.com:^"
        )
        parsed = {}
        for message in messages:
            parsed.update(message)

        self.assertEqual(parsed["source_station"]["station_code"], "NDLS")
        self.assertEqual(parsed["destination_station"]["eng_name"], "HYDERABAD")
        self.assertEqual(parsed["date"]["dateData"], "06")
        self.assertEqual(parsed["month"]["monthData"], "12")
        self.assertEqual(parsed["adult"]["adultData"], "60")
        self.assertEqual(parsed["child"]["childData"], "04")
        self.assertEqual(parsed["type_of_trian"]["value"], "SUP")
        self.assertEqual(parsed["fare"]["fareData"], "45604")
        self.assertEqual(parsed["class"]["Class"], "II")
        self.assertEqual(parsed["transaction_type"]["transactionType"], "BPT TICKET")
        self.assertEqual(parsed["operator_details"]["Operator"], "SHASHI KUMAR")
        self.assertEqual(parsed["payment_gateway"]["paymentGateway"], "phonepaytest.com")

    def test_fragmented_frames_and_clear_command(self):
        stream = FrameStream()
        self.assertEqual(stream.feed("$0126NDLS:NEW "), [])
        messages = stream.feed("DELHI:NEW DELHI:^$1303 :^")
        self.assertEqual(messages[0]["source_station"]["station_code"], "NDLS")
        self.assertIn("clear_display_device", messages[1])

    def test_qr_payload_uses_variable_length_field(self):
        access_key, value, error = parse_frame("$2205HELLO:^")
        self.assertIsNone(error)
        self.assertEqual(access_key, "qr_code")
        self.assertEqual(value, {"QRCode": "HELLO"})

    def test_modern_train_types_supported(self):
        key, val, err = parse_frame("$0703V:^")
        self.assertIsNone(err)
        self.assertEqual(val["value"], "VDB")
        self.assertEqual(val["description"], "VANDE BHARAT")

        key, val, err = parse_frame("$0703N:^")
        self.assertIsNone(err)
        self.assertEqual(val["value"], "AB")
        self.assertEqual(val["description"], "AMRIT BHARAT")

    def test_modern_transaction_types_supported(self):
        key, val, err = parse_frame("$1205DUP:^")
        self.assertIsNone(err)
        self.assertEqual(val["transactionType"], "DUPLICATE TICKET")

        key, val, err = parse_frame("$1205CONC:^")
        self.assertIsNone(err)
        self.assertEqual(val["transactionType"], "CONCESSION")

    def test_cancellation_refund_frame_parsing(self):
        key, val, err = parse_frame("$1422CANC:CASH:450:^")
        self.assertIsNone(err)
        self.assertEqual(key, "cancellation_refund_amount")
        self.assertEqual(val["code"], "CANCELLATION")
        self.assertEqual(val["type"], "CASH")
        self.assertEqual(val["amount"], "450")

    def test_via_route_stations_parsing(self):
        key, val, err = parse_frame("$1724CNB:KANPUR:कानपुर:^")
        self.assertIsNone(err)
        self.assertEqual(key, "source_station_2")
        self.assertEqual(val["sourceStation2Code"], "CNB")
        self.assertEqual(val["sourceStation2NameEnglish"], "KANPUR")

    def test_utf8_hindi_bytes_decoding(self):
        stream = FrameStream()
        # Feed UTF-8 encoded bytes with Hindi station text
        raw_bytes = "$0128NDLS:NEW DELHI:नई दिल्ली:^".encode("utf-8")
        messages = stream.feed(raw_bytes)
        self.assertEqual(len(messages), 1)
        source = messages[0]["source_station"]
        self.assertEqual(source["station_code"], "NDLS")
        self.assertEqual(source["eng_name"], "NEW DELHI")
        self.assertEqual(source["hin_name"], "नई दिल्ली")

    def test_resync_on_nested_frame_start(self):
        stream = FrameStream()
        messages = stream.feed("junk$0110CORRUPT$0703S:^")
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["type_of_trian"]["value"], "SUP")
        self.assertIn("resynchronized-at-new-frame", stream.errors)

    def test_atomic_config_save_and_load(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            cfg_path = Path(temp_dir) / "test-config.json"
            sample_cfg = {
                "port": "/dev/ttyUSB0",
                "baudRate": "115200",
                "station": "PATNA JN",
                "displayFps": 10,
            }
            save_config(cfg_path, sample_cfg)
            loaded = load_config(cfg_path)
            self.assertEqual(loaded["port"], "/dev/ttyUSB0")
            self.assertEqual(loaded["baudRate"], "115200")
            self.assertEqual(loaded["station"], "PATNA JN")
            self.assertEqual(loaded["displayFps"], 10)
            # Defaults should be preserved
            self.assertEqual(loaded["zone"], DEFAULTS["zone"])


if __name__ == "__main__":
    unittest.main()
