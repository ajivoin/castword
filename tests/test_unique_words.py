"""Tests for unique_words.py — word analysis functions."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from unique_words import (
    normalize,
    clean_text,
    tokenize,
    card_name_variants,
    is_paper_card,
    is_alchemy_card,
    filter_cards,
    build_word_card_map,
    find_unique_word_cards,
)


# ── normalize ────────────────────────────────────────────────────────────────

class TestNormalize:
    def test_lowercases_ascii(self):
        assert normalize("Hello World") == "hello world"

    def test_strips_combining_accent(self):
        # é (e + combining accent) → e
        assert normalize("élite") == "elite"

    def test_already_normalized_unchanged(self):
        assert normalize("counter") == "counter"

    def test_preserves_spaces(self):
        assert normalize("two words") == "two words"

    def test_empty_string(self):
        assert normalize("") == ""


# ── clean_text ────────────────────────────────────────────────────────────────

class TestCleanText:
    def test_removes_mana_symbols(self):
        result = clean_text("{W}{U} deal damage", exclude_reminder=False)
        assert "{" not in result
        assert "}" not in result

    def test_removes_complex_mana_symbols(self):
        result = clean_text("{2/W} tap {T}", exclude_reminder=False)
        assert "{" not in result

    def test_preserves_reminder_text_when_not_excluded(self):
        result = clean_text("Flying (reminder text here)", exclude_reminder=False)
        assert "reminder text here" in result

    def test_removes_reminder_text_when_excluded(self):
        result = clean_text("Flying (This creature can fly.)", exclude_reminder=True)
        assert "this creature can fly" not in result

    def test_normalizes_output(self):
        result = clean_text("UPPER CASE", exclude_reminder=False)
        assert result == result.lower()

    def test_handles_empty_string(self):
        assert clean_text("", exclude_reminder=False) == ""


# ── tokenize ──────────────────────────────────────────────────────────────────

class TestTokenize:
    def test_basic_words(self):
        assert tokenize("counter target spell") == ["counter", "target", "spell"]

    def test_preserves_hyphenated_words(self):
        tokens = tokenize("first-strike ability")
        assert "first-strike" in tokens

    def test_empty_string(self):
        assert tokenize("") == []

    def test_strips_punctuation(self):
        tokens = tokenize("hello, world!")
        assert tokens == ["hello", "world"]

    def test_handles_newlines(self):
        tokens = tokenize("line one\nline two")
        assert "one" in tokens
        assert "two" in tokens

    def test_numbers_not_returned(self):
        # TOKEN_RE matches [a-z]+ so standalone digits are excluded
        tokens = tokenize("deal 3 damage")
        assert "3" not in tokens


# ── card_name_variants ────────────────────────────────────────────────────────

class TestCardNameVariants:
    def test_simple_name(self):
        variants = card_name_variants("Counterspell")
        assert "counterspell" in variants

    def test_legendary_name_includes_prefix(self):
        variants = card_name_variants("Urza, Lord of Ingenuity")
        assert "urza" in variants
        assert "lord" in variants

    def test_split_card_includes_both_faces(self):
        variants = card_name_variants("Fire // Ice")
        assert "fire" in variants
        assert "ice" in variants

    def test_returns_set(self):
        result = card_name_variants("Counterspell")
        assert isinstance(result, set)


# ── is_paper_card ─────────────────────────────────────────────────────────────

class TestIsPaperCard:
    def test_normal_card_is_paper(self):
        card = {"set_type": "expansion", "layout": "normal"}
        assert is_paper_card(card) is True

    def test_alchemy_set_type_is_not_paper(self):
        card = {"set_type": "alchemy", "layout": "normal"}
        assert is_paper_card(card) is False

    def test_memorabilia_set_type_is_not_paper(self):
        card = {"set_type": "memorabilia", "layout": "normal"}
        assert is_paper_card(card) is False

    def test_sticker_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "sticker"}
        assert is_paper_card(card) is False

    def test_attraction_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "attraction"}
        assert is_paper_card(card) is False

    def test_contraption_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "contraption"}
        assert is_paper_card(card) is False

    def test_token_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "token"}
        assert is_paper_card(card) is False

    def test_double_faced_token_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "double_faced_token"}
        assert is_paper_card(card) is False

    def test_emblem_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "emblem"}
        assert is_paper_card(card) is False

    def test_art_series_layout_is_not_paper(self):
        card = {"set_type": "expansion", "layout": "art_series"}
        assert is_paper_card(card) is False


# ── is_alchemy_card ───────────────────────────────────────────────────────────

class TestIsAlchemyCard:
    def test_a_hyphen_prefix_is_alchemy(self):
        assert is_alchemy_card({"name": "A-Counterspell"}) is True

    def test_regular_card_is_not_alchemy(self):
        assert is_alchemy_card({"name": "Counterspell"}) is False

    def test_name_starting_with_a_space_is_not_alchemy(self):
        assert is_alchemy_card({"name": "A Spell"}) is False

    def test_empty_name(self):
        assert is_alchemy_card({"name": ""}) is False


# ── filter_cards ──────────────────────────────────────────────────────────────

class TestFilterCards:
    def _make_cards(self):
        return [
            {"name": "Normal",      "oracle_id": "1", "set_type": "expansion", "layout": "normal"},
            {"name": "A-Rebalance", "oracle_id": "2", "set_type": "expansion", "layout": "normal"},
            {"name": "Digital",     "oracle_id": "3", "set_type": "alchemy",   "layout": "normal"},
            {"name": "Sticker",     "oracle_id": "4", "set_type": "expansion", "layout": "sticker"},
            {"name": "Token",       "oracle_id": "5", "set_type": "expansion", "layout": "token"},
            {"name": "DFToken",     "oracle_id": "6", "set_type": "expansion", "layout": "double_faced_token"},
            {"name": "Emblem",      "oracle_id": "7", "set_type": "expansion", "layout": "emblem"},
            {"name": "ArtSeries",   "oracle_id": "8", "set_type": "expansion", "layout": "art_series"},
        ]

    def test_default_excludes_alchemy_and_digital(self):
        cards = self._make_cards()
        result = filter_cards(cards, include_digital=False, include_alchemy=False)
        names = {c["name"] for c in result}
        assert "Normal" in names
        assert "A-Rebalance" not in names
        assert "Digital" not in names
        assert "Sticker" not in names

    def test_default_excludes_non_card_layouts(self):
        cards = self._make_cards()
        result = filter_cards(cards, include_digital=False, include_alchemy=False)
        names = {c["name"] for c in result}
        assert "Token" not in names
        assert "DFToken" not in names
        assert "Emblem" not in names
        assert "ArtSeries" not in names

    def test_include_alchemy_keeps_a_prefix(self):
        cards = self._make_cards()
        result = filter_cards(cards, include_digital=False, include_alchemy=True)
        names = {c["name"] for c in result}
        assert "A-Rebalance" in names

    def test_include_digital_keeps_digital_layouts(self):
        cards = self._make_cards()
        result = filter_cards(cards, include_digital=True, include_alchemy=False)
        names = {c["name"] for c in result}
        assert "Sticker" in names


# ── build_word_card_map ────────────────────────────────────────────────────────

class TestBuildWordCardMap:
    def _make_simple_cards(self):
        return [
            {
                "name": "Alpha",
                "oracle_id": "oid-alpha",
                "oracle_text": "This spell has unique text.",
                "set_type": "expansion",
                "layout": "normal",
                "collector_number": "1",
                "scryfall_uri": "",
                "type_line": "Sorcery",
                "set": "test",
            },
            {
                "name": "Beta",
                "oracle_id": "oid-beta",
                "oracle_text": "This spell has shared text.",
                "set_type": "expansion",
                "layout": "normal",
                "collector_number": "2",
                "scryfall_uri": "",
                "type_line": "Sorcery",
                "set": "test",
            },
            {
                "name": "Gamma",
                "oracle_id": "oid-gamma",
                "oracle_text": "This spell has shared text.",
                "set_type": "expansion",
                "layout": "normal",
                "collector_number": "3",
                "scryfall_uri": "",
                "type_line": "Sorcery",
                "set": "test",
            },
        ]

    def test_unique_word_mapped_to_single_card(self):
        cards = self._make_simple_cards()
        word_to_cards, _ = build_word_card_map(cards, min_word_len=3, include_flavor=False, exclude_reminder=False)
        assert "unique" in word_to_cards
        assert word_to_cards["unique"] == {"oid-alpha"}

    def test_shared_word_mapped_to_multiple_cards(self):
        cards = self._make_simple_cards()
        word_to_cards, _ = build_word_card_map(cards, min_word_len=3, include_flavor=False, exclude_reminder=False)
        assert "shared" in word_to_cards
        assert "oid-beta" in word_to_cards["shared"]
        assert "oid-gamma" in word_to_cards["shared"]

    def test_short_tokens_excluded_by_min_word_len(self):
        cards = self._make_simple_cards()
        word_to_cards, _ = build_word_card_map(cards, min_word_len=5, include_flavor=False, exclude_reminder=False)
        # "has" is 3 chars, excluded at min_word_len=5
        assert "has" not in word_to_cards

    def test_card_name_tokens_suppressed(self):
        cards = self._make_simple_cards()
        word_to_cards, _ = build_word_card_map(cards, min_word_len=3, include_flavor=False, exclude_reminder=False)
        # "alpha" is in Alpha's name, should not appear in its word map
        assert "oid-alpha" not in word_to_cards.get("alpha", set())

    def test_flavor_text_included_when_requested(self):
        cards = [{
            "name": "Flavorsome",
            "oracle_id": "oid-flav",
            "oracle_text": "Does something.",
            "flavor_text": "Extraordinary flavor here.",
            "set_type": "expansion",
            "layout": "normal",
            "collector_number": "1",
            "scryfall_uri": "",
            "type_line": "Sorcery",
            "set": "test",
        }]
        word_to_cards, _ = build_word_card_map(cards, min_word_len=3, include_flavor=True, exclude_reminder=False)
        assert "extraordinary" in word_to_cards

    def test_flavor_text_excluded_when_not_requested(self):
        cards = [{
            "name": "Flavorsome",
            "oracle_id": "oid-flav",
            "oracle_text": "Does something.",
            "flavor_text": "Extraordinary flavor here.",
            "set_type": "expansion",
            "layout": "normal",
            "collector_number": "1",
            "scryfall_uri": "",
            "type_line": "Sorcery",
            "set": "test",
        }]
        word_to_cards, _ = build_word_card_map(cards, min_word_len=3, include_flavor=False, exclude_reminder=False)
        assert "extraordinary" not in word_to_cards


# ── find_unique_word_cards ────────────────────────────────────────────────────

class TestFindUniqueWordCards:
    def test_returns_card_with_unique_word(self):
        word_to_cards = {"unique": {"oid-1"}, "shared": {"oid-1", "oid-2"}}
        meta = {
            "oid-1": {"name": "Alpha", "oracle_id": "oid-1", "scryfall_uri": "", "set": "t", "collector_number": "1", "type_line": "S"},
            "oid-2": {"name": "Beta",  "oracle_id": "oid-2", "scryfall_uri": "", "set": "t", "collector_number": "2", "type_line": "S"},
        }
        results = find_unique_word_cards(word_to_cards, meta)
        names = [r["name"] for r in results]
        assert "Alpha" in names

    def test_excludes_card_without_unique_word(self):
        word_to_cards = {"shared": {"oid-1", "oid-2"}}
        meta = {
            "oid-1": {"name": "Alpha", "oracle_id": "oid-1", "scryfall_uri": "", "set": "t", "collector_number": "1", "type_line": "S"},
            "oid-2": {"name": "Beta",  "oracle_id": "oid-2", "scryfall_uri": "", "set": "t", "collector_number": "2", "type_line": "S"},
        }
        results = find_unique_word_cards(word_to_cards, meta)
        assert results == []

    def test_unique_words_list_is_sorted(self):
        word_to_cards = {"zzz": {"oid-1"}, "aaa": {"oid-1"}}
        meta = {"oid-1": {"name": "X", "oracle_id": "oid-1", "scryfall_uri": "", "set": "t", "collector_number": "1", "type_line": "S"}}
        results = find_unique_word_cards(word_to_cards, meta)
        assert results[0]["unique_words"] == ["aaa", "zzz"]

    def test_results_sorted_by_name(self):
        word_to_cards = {"x": {"oid-2"}, "y": {"oid-1"}}
        meta = {
            "oid-1": {"name": "Zebra",  "oracle_id": "oid-1", "scryfall_uri": "", "set": "t", "collector_number": "1", "type_line": "S"},
            "oid-2": {"name": "Alpaca", "oracle_id": "oid-2", "scryfall_uri": "", "set": "t", "collector_number": "2", "type_line": "S"},
        }
        results = find_unique_word_cards(word_to_cards, meta)
        assert results[0]["name"] == "Alpaca"
        assert results[1]["name"] == "Zebra"
