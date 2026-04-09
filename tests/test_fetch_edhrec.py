"""Tests for fetch_edhrec.py — slug conversion and JSON parsing."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fetch_edhrec import card_to_edhrec_slug, extract_num_decks


# ── card_to_edhrec_slug ───────────────────────────────────────────────────────

class TestCardToEdhrecSlug:
    def test_simple_name(self):
        assert card_to_edhrec_slug("Counterspell") == "counterspell"

    def test_space_becomes_hyphen(self):
        assert card_to_edhrec_slug("Sol Ring") == "sol-ring"

    def test_comma_dropped(self):
        assert card_to_edhrec_slug("Tasha, the Witch Queen") == "tasha-the-witch-queen"

    def test_apostrophe_dropped(self):
        assert card_to_edhrec_slug("Urza's Tower") == "urzas-tower"

    def test_split_card_uses_front_face_only(self):
        assert card_to_edhrec_slug("Fire // Ice") == "fire"

    def test_multiple_spaces_become_single_hyphen(self):
        # Multiple consecutive non-alphanum become one hyphen
        result = card_to_edhrec_slug("One  Two")
        assert "--" not in result
        assert result == "one-two"

    def test_no_leading_or_trailing_hyphen(self):
        result = card_to_edhrec_slug("Test Card")
        assert not result.startswith("-")
        assert not result.endswith("-")

    def test_lowercase_output(self):
        result = card_to_edhrec_slug("UPPER CASE")
        assert result == result.lower()

    def test_numbers_preserved(self):
        assert card_to_edhrec_slug("Emrakul, the Promised End") == "emrakul-the-promised-end"


# ── extract_num_decks ─────────────────────────────────────────────────────────

class TestExtractNumDecks:
    def test_top_level_num_decks(self):
        assert extract_num_decks({"num_decks": 15000}) == 15000

    def test_nested_in_card(self):
        assert extract_num_decks({"card": {"num_decks": 5000}}) == 5000

    def test_nested_in_data(self):
        assert extract_num_decks({"data": {"num_decks": 3000}}) == 3000

    def test_nested_in_container_json_dict(self):
        data = {"container": {"json_dict": {"num_decks": 2000}}}
        assert extract_num_decks(data) == 2000

    def test_nested_in_container_json_dict_card(self):
        data = {"container": {"json_dict": {"card": {"num_decks": 1000}}}}
        assert extract_num_decks(data) == 1000

    def test_empty_dict_returns_none(self):
        assert extract_num_decks({}) is None

    def test_non_dict_input_returns_none(self):
        assert extract_num_decks(None) is None
        assert extract_num_decks("string") is None
        assert extract_num_decks(42) is None
        assert extract_num_decks([]) is None

    def test_string_value_converted_to_int(self):
        assert extract_num_decks({"num_decks": "200"}) == 200

    def test_zero_is_valid_value(self):
        assert extract_num_decks({"num_decks": 0}) == 0

    def test_invalid_string_returns_none(self):
        assert extract_num_decks({"num_decks": "not-a-number"}) is None
