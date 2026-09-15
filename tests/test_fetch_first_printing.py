"""Tests for fetch_first_printing.py — Scryfall search response parsing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fetch_first_printing import extract_first_printing


# ── extract_first_printing ───────────────────────────────────────────────────

class TestExtractFirstPrinting:
    def test_single_print(self):
        data = {"data": [{"set_name": "Limited Edition Alpha", "released_at": "1993-08-05"}]}
        assert extract_first_printing(data) == {
            "set_name": "Limited Edition Alpha",
            "released_at": "1993-08-05",
        }

    def test_multiple_prints_uses_first(self):
        data = {
            "data": [
                {"set_name": "Limited Edition Alpha", "released_at": "1993-08-05"},
                {"set_name": "Limited Edition Beta", "released_at": "1993-10-01"},
            ]
        }
        assert extract_first_printing(data) == {
            "set_name": "Limited Edition Alpha",
            "released_at": "1993-08-05",
        }

    def test_empty_data_list_returns_none(self):
        assert extract_first_printing({"data": []}) is None

    def test_missing_data_key_returns_none(self):
        assert extract_first_printing({}) is None

    def test_non_dict_input_returns_none(self):
        assert extract_first_printing(None) is None
        assert extract_first_printing("string") is None
        assert extract_first_printing(42) is None
        assert extract_first_printing([]) is None

    def test_data_not_a_list_returns_none(self):
        assert extract_first_printing({"data": {"set_name": "Oops"}}) is None

    def test_first_entry_not_a_dict_returns_none(self):
        assert extract_first_printing({"data": ["not-a-dict"]}) is None

    def test_missing_set_name_returns_blank_for_that_field(self):
        data = {"data": [{"released_at": "1993-08-05"}]}
        assert extract_first_printing(data) == {"set_name": "", "released_at": "1993-08-05"}

    def test_missing_released_at_returns_blank_for_that_field(self):
        data = {"data": [{"set_name": "Limited Edition Alpha"}]}
        assert extract_first_printing(data) == {"set_name": "Limited Edition Alpha", "released_at": ""}

    def test_entry_missing_both_fields_returns_blanks(self):
        data = {"data": [{}]}
        assert extract_first_printing(data) == {"set_name": "", "released_at": ""}

    def test_extra_fields_on_entry_are_ignored(self):
        data = {"data": [{
            "set_name": "Kamigawa: Neon Dynasty",
            "released_at": "2022-02-18",
            "collector_number": "123",
            "rarity": "rare",
        }]}
        assert extract_first_printing(data) == {
            "set_name": "Kamigawa: Neon Dynasty",
            "released_at": "2022-02-18",
        }
