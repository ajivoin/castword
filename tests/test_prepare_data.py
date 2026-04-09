"""Tests for prepare_data.py — card enrichment functions."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from prepare_data import (
    get_image_url,
    get_image_url_back,
    get_oracle_text,
    get_flavor_text,
    flavor_exclusive_words,
    DOUBLE_FACED_LAYOUTS,
)


# ── get_image_url ─────────────────────────────────────────────────────────────

class TestGetImageUrl:
    def test_card_with_image_uris(self):
        card = {"image_uris": {"normal": "https://example.com/front.jpg"}}
        assert get_image_url(card) == "https://example.com/front.jpg"

    def test_card_with_card_faces(self):
        card = {
            "card_faces": [
                {"image_uris": {"normal": "https://example.com/face0.jpg"}},
                {"image_uris": {"normal": "https://example.com/face1.jpg"}},
            ]
        }
        assert get_image_url(card) == "https://example.com/face0.jpg"

    def test_card_with_no_images(self):
        card = {}
        assert get_image_url(card) == ""

    def test_prefers_top_level_image_uris_over_card_faces(self):
        card = {
            "image_uris": {"normal": "https://example.com/top.jpg"},
            "card_faces": [{"image_uris": {"normal": "https://example.com/face.jpg"}}],
        }
        assert get_image_url(card) == "https://example.com/top.jpg"


# ── get_image_url_back ────────────────────────────────────────────────────────

class TestGetImageUrlBack:
    def test_non_double_faced_returns_empty(self):
        card = {"layout": "normal"}
        assert get_image_url_back(card) == ""

    def test_transform_card_with_back_face_image(self):
        card = {
            "layout": "transform",
            "card_faces": [
                {"image_uris": {"normal": "https://example.com/front.jpg"}},
                {"image_uris": {"normal": "https://example.com/back.jpg"}},
            ],
        }
        assert get_image_url_back(card) == "https://example.com/back.jpg"

    def test_modal_dfc_layout_is_double_faced(self):
        card = {
            "layout": "modal_dfc",
            "card_faces": [
                {"image_uris": {"normal": "https://example.com/front.jpg"}},
                {"image_uris": {"normal": "https://example.com/back.jpg"}},
            ],
        }
        assert get_image_url_back(card) == "https://example.com/back.jpg"

    def test_falls_back_to_front_back_url_substitution(self):
        card = {
            "layout": "transform",
            "card_faces": [
                {"image_uris": {"normal": "https://example.com/cards/front/a.jpg"}},
                {},  # no image_uris on back face
            ],
        }
        result = get_image_url_back(card)
        assert result == "https://example.com/cards/back/a.jpg"

    def test_layout_not_in_double_faced_layouts_returns_empty(self):
        card = {"layout": "split", "card_faces": [
            {"image_uris": {"normal": "x"}},
            {"image_uris": {"normal": "y"}},
        ]}
        assert get_image_url_back(card) == ""

    def test_all_double_faced_layouts_defined(self):
        assert "transform" in DOUBLE_FACED_LAYOUTS
        assert "modal_dfc" in DOUBLE_FACED_LAYOUTS
        assert "reversible_card" in DOUBLE_FACED_LAYOUTS
        assert "double_faced_token" in DOUBLE_FACED_LAYOUTS


# ── get_oracle_text ───────────────────────────────────────────────────────────

class TestGetOracleText:
    def test_normal_card_returns_oracle_text(self):
        card = {"oracle_text": "Counter target spell."}
        assert get_oracle_text(card) == "Counter target spell."

    def test_multiface_card_joins_faces_with_separator(self):
        card = {
            "card_faces": [
                {"oracle_text": "Front text."},
                {"oracle_text": "Back text."},
            ]
        }
        result = get_oracle_text(card)
        assert result == "Front text.\n//\nBack text."

    def test_multiface_skips_faces_with_no_oracle_text(self):
        card = {
            "card_faces": [
                {"oracle_text": "Has text."},
                {},
            ]
        }
        result = get_oracle_text(card)
        assert result == "Has text."

    def test_empty_oracle_text(self):
        card = {"oracle_text": ""}
        assert get_oracle_text(card) == ""


# ── get_flavor_text ───────────────────────────────────────────────────────────

class TestGetFlavorText:
    def test_normal_card_returns_flavor_text(self):
        card = {"flavor_text": '"I have a better idea."'}
        assert get_flavor_text(card) == '"I have a better idea."'

    def test_card_with_no_flavor_text(self):
        card = {}
        assert get_flavor_text(card) == ""

    def test_multiface_joins_nonempty_flavor_texts(self):
        card = {
            "card_faces": [
                {"flavor_text": "Front flavor."},
                {"flavor_text": "Back flavor."},
            ]
        }
        result = get_flavor_text(card)
        assert result == "Front flavor.\n//\nBack flavor."

    def test_multiface_skips_empty_flavor_texts(self):
        card = {
            "card_faces": [
                {"flavor_text": "Only one face has flavor."},
                {},
            ]
        }
        result = get_flavor_text(card)
        assert result == "Only one face has flavor."


# ── flavor_exclusive_words ────────────────────────────────────────────────────

class TestFlavorExclusiveWords:
    def _make_card(self, oracle="", flavor=""):
        return {"oracle_text": oracle, "flavor_text": flavor}

    def test_word_only_in_flavor_is_included(self):
        card = self._make_card(oracle="Counter target spell.", flavor="Extraordinary countermeasure.")
        result = flavor_exclusive_words(card, ["extraordinary"])
        assert "extraordinary" in result

    def test_word_only_in_oracle_is_excluded(self):
        card = self._make_card(oracle="Counter target spell.", flavor="Some flavor.")
        result = flavor_exclusive_words(card, ["counter"])
        assert "counter" not in result

    def test_word_in_both_is_excluded(self):
        card = self._make_card(oracle="Shared word here.", flavor="The shared word again.")
        result = flavor_exclusive_words(card, ["shared"])
        assert "shared" not in result

    def test_word_in_neither_is_excluded(self):
        card = self._make_card(oracle="Some text.", flavor="More text.")
        result = flavor_exclusive_words(card, ["xyzzy"])
        assert "xyzzy" not in result

    def test_empty_unique_words_returns_empty(self):
        card = self._make_card(oracle="Some text.", flavor="Some flavor.")
        assert flavor_exclusive_words(card, []) == []

    def test_multiface_card(self):
        card = {
            "card_faces": [
                {"oracle_text": "Front oracle.", "flavor_text": ""},
                {"oracle_text": "", "flavor_text": "Exclusive back flavor."},
            ]
        }
        result = flavor_exclusive_words(card, ["exclusive"])
        assert "exclusive" in result
