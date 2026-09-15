"""Tests for first_printings.py — deriving first paper printings from the
Scryfall default-cards bulk file (every printing of every card)."""
import gzip
import json
import sys
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from first_printings import (
    download_default_cards,
    earliest_printings,
    load_first_printings,
)


def printing(oracle_id, set_name, released_at, games=("paper",), **extra):
    rec = {
        "oracle_id": oracle_id,
        "set_name": set_name,
        "released_at": released_at,
        "games": list(games),
    }
    rec.update(extra)
    return rec


# ── earliest_printings ───────────────────────────────────────────────────────

class TestEarliestPrintings:
    def test_single_paper_printing(self):
        recs = [printing("abc", "Limited Edition Alpha", "1993-08-05")]
        assert earliest_printings(recs) == {
            "abc": {
                "set_name": "Limited Edition Alpha",
                "released_at": "1993-08-05",
                "platform": "Paper",
            }
        }

    def test_earliest_of_several_wins(self):
        recs = [
            printing("abc", "Limited Edition Beta", "1993-10-01"),
            printing("abc", "Limited Edition Alpha", "1993-08-05"),
            printing("abc", "Revised Edition", "1994-04-11"),
        ]
        assert earliest_printings(recs)["abc"]["set_name"] == "Limited Edition Alpha"

    def test_input_order_does_not_matter(self):
        early = printing("abc", "Alpha", "1993-08-05")
        late = printing("abc", "Modern Horizons", "2019-06-14")
        assert earliest_printings([early, late]) == earliest_printings([late, early])

    def test_multiple_cards_tracked_independently(self):
        recs = [
            printing("abc", "Alpha", "1993-08-05"),
            printing("xyz", "Innistrad", "2011-09-30"),
            printing("abc", "Revised", "1994-04-11"),
        ]
        result = earliest_printings(recs)
        assert result["abc"]["set_name"] == "Alpha"
        assert result["xyz"]["set_name"] == "Innistrad"

    def test_paper_wins_even_when_a_digital_printing_came_first(self):
        recs = [
            printing("abc", "Alchemy: Innistrad", "2021-12-09", games=("arena",)),
            printing("abc", "Mystery Booster 2", "2024-08-02"),
        ]
        assert earliest_printings(recs)["abc"] == {
            "set_name": "Mystery Booster 2",
            "released_at": "2024-08-02",
            "platform": "Paper",
        }

    def test_card_with_no_paper_printing_falls_back_to_digital(self):
        recs = [printing("abc", "Jumpstart: Historic Horizons", "2021-08-26", games=("arena",))]
        assert earliest_printings(recs)["abc"] == {
            "set_name": "Jumpstart: Historic Horizons",
            "released_at": "2021-08-26",
            "platform": "Arena",
        }

    def test_earliest_digital_printing_wins_among_digital_only(self):
        recs = [
            printing("abc", "Alchemy: The Brothers' War", "2022-12-13", games=("arena",)),
            printing("abc", "Jumpstart: Historic Horizons", "2021-08-26", games=("arena",)),
        ]
        assert earliest_printings(recs)["abc"]["set_name"] == "Jumpstart: Historic Horizons"

    # Platform naming — one case per group seen in the real default-cards data.

    def test_alchemy_set_type_is_named_alchemy_not_arena(self):
        """Alchemy printings carry games=['arena'], so set_type decides."""
        rec = printing("abc", "Alchemy: Murders at Karlov Manor", "2024-03-05",
                       games=("arena",), set_type="alchemy")
        assert earliest_printings([rec])["abc"]["platform"] == "Alchemy"

    def test_arena_only_printing_is_named_arena(self):
        rec = printing("abc", "Jumpstart: Historic Horizons", "2021-08-26",
                       games=("arena",), set_type="draft_innovation")
        assert earliest_printings([rec])["abc"]["platform"] == "Arena"

    def test_mtgo_only_printing_is_named_magic_online(self):
        rec = printing("abc", "Magic Online Avatars", "2003-01-01",
                       games=("mtgo",), set_type="vanguard")
        assert earliest_printings([rec])["abc"]["platform"] == "Magic Online"

    def test_astral_printing_is_named_astral(self):
        rec = printing("abc", "Astral Cards", "1997-04-01", games=("astral",), set_type="box")
        assert earliest_printings([rec])["abc"]["platform"] == "Astral"

    def test_paper_printing_is_named_paper(self):
        rec = printing("abc", "Alpha", "1993-08-05", games=("paper", "mtgo"))
        assert earliest_printings([rec])["abc"]["platform"] == "Paper"

    def test_paper_wins_over_alchemy_set_type(self):
        """A paper Alchemy reprint is still paper."""
        rec = printing("abc", "Mystery Booster 2", "2024-08-02",
                       games=("paper",), set_type="alchemy")
        assert earliest_printings([rec])["abc"]["platform"] == "Paper"

    # Records that carry no playable platform at all.

    def test_unreleased_printing_with_empty_games_is_skipped(self):
        """Scryfall leaves `games` empty on unreleased printings; those stay
        absent so they resolve on their own once the set is out."""
        rec = {"oracle_id": "abc", "set_name": "Reality Fracture",
               "released_at": "2026-10-02", "games": [], "digital": False,
               "set_type": "expansion"}
        assert earliest_printings([rec]) == {}

    def test_missing_games_field_is_skipped(self):
        recs = [{"oracle_id": "abc", "set_name": "Mystery", "released_at": "2000-01-01"}]
        assert earliest_printings(recs) == {}

    def test_unreleased_printing_does_not_mask_a_real_one(self):
        recs = [
            {"oracle_id": "abc", "set_name": "Reality Fracture",
             "released_at": "2026-10-02", "games": []},
            printing("abc", "Alpha", "1993-08-05"),
        ]
        assert earliest_printings(recs)["abc"]["set_name"] == "Alpha"

    def test_printing_without_release_date_is_skipped(self):
        recs = [
            printing("abc", "Undated Promo", ""),
            printing("abc", "Innistrad", "2011-09-30"),
        ]
        assert earliest_printings(recs)["abc"]["set_name"] == "Innistrad"

    def test_card_with_only_undated_printings_is_absent(self):
        assert earliest_printings([printing("abc", "Undated Promo", "")]) == {}

    def test_oracle_id_falls_back_to_card_faces(self):
        rec = {
            "set_name": "Innistrad: Double Feature",
            "released_at": "2022-01-28",
            "games": ["paper"],
            "card_faces": [{"oracle_id": "face-id"}, {"oracle_id": "other-id"}],
        }
        assert earliest_printings([rec])["face-id"]["set_name"] == "Innistrad: Double Feature"

    def test_printing_without_any_oracle_id_is_skipped(self):
        rec = {"set_name": "Orphan", "released_at": "2000-01-01", "games": ["paper"]}
        assert earliest_printings([rec]) == {}

    def test_malformed_records_are_skipped(self):
        recs = [None, "not-a-dict", 42, [], printing("abc", "Alpha", "1993-08-05")]
        assert earliest_printings(recs) == {
            "abc": {"set_name": "Alpha", "released_at": "1993-08-05", "platform": "Paper"}
        }

    def test_missing_set_name_yields_blank_string(self):
        rec = {"oracle_id": "abc", "released_at": "1993-08-05", "games": ["paper"]}
        assert earliest_printings([rec])["abc"] == {
            "set_name": "", "released_at": "1993-08-05", "platform": "Paper"
        }

    def test_tie_on_release_date_keeps_first_seen(self):
        recs = [
            printing("abc", "Alpha", "1993-08-05"),
            printing("abc", "Beta", "1993-08-05"),
        ]
        assert earliest_printings(recs)["abc"]["set_name"] == "Alpha"

    def test_empty_input_yields_empty_map(self):
        assert earliest_printings([]) == {}

    def test_result_entries_match_first_printed_fields_contract(self):
        """prepare_data.first_printed_fields consumes these entries directly."""
        from prepare_data import first_printed_fields

        entry = earliest_printings([printing("abc", "Alpha", "1993-08-05")])["abc"]
        assert first_printed_fields(entry) == {
            "first_set_name": "Alpha",
            "first_printed_year": "1993",
            "first_printed_platform": "Paper",
        }


# ── load_first_printings ─────────────────────────────────────────────────────

class TestLoadFirstPrintings:
    def test_reads_gzipped_json_lines(self, tmp_path):
        path = tmp_path / "default-cards.jsonl.gz"
        with gzip.open(path, "wt", encoding="utf-8") as f:
            for rec in [
                printing("abc", "Revised", "1994-04-11"),
                printing("abc", "Alpha", "1993-08-05"),
                printing("xyz", "Innistrad", "2011-09-30"),
            ]:
                f.write(json.dumps(rec) + "\n")

        result = load_first_printings(path)
        assert result["abc"]["set_name"] == "Alpha"
        assert result["xyz"]["set_name"] == "Innistrad"

    def test_blank_lines_are_ignored(self, tmp_path):
        path = tmp_path / "default-cards.jsonl.gz"
        with gzip.open(path, "wt", encoding="utf-8") as f:
            f.write("\n")
            f.write(json.dumps(printing("abc", "Alpha", "1993-08-05")) + "\n")
            f.write("   \n")

        assert load_first_printings(path)["abc"]["set_name"] == "Alpha"

    def test_missing_file_returns_empty_map(self, tmp_path):
        assert load_first_printings(tmp_path / "nope.jsonl.gz") == {}

    def test_plain_json_lines_file_is_also_supported(self, tmp_path):
        """The CI cache may hold an uncompressed file; don't crash on it."""
        path = tmp_path / "default-cards.jsonl"
        path.write_text(json.dumps(printing("abc", "Alpha", "1993-08-05")) + "\n")
        assert load_first_printings(path)["abc"]["set_name"] == "Alpha"


# ── download_default_cards ───────────────────────────────────────────────────

class FakeResponse:
    """Minimal stand-in for the object returned by urllib.request.urlopen."""

    def __init__(self, data: bytes):
        self._buf = BytesIO(data)
        self.headers = {"Content-Length": str(len(data))}

    def read(self, size=-1):
        return self._buf.read(size)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class TestDownloadDefaultCards:
    def test_saves_the_gzipped_download_verbatim(self, tmp_path):
        """The file is streamed later, so it must stay gzipped JSON Lines
        rather than being expanded into a JSON array on disk."""
        recs = [printing("abc", "Alpha", "1993-08-05")]
        gz_bytes = gzip.compress(("\n".join(json.dumps(r) for r in recs)).encode("utf-8"))
        dest = tmp_path / "default-cards.jsonl.gz"

        with patch("first_printings.fetch_bulk_download_url",
                   return_value="https://data.scryfall.io/default-cards/default-cards.jsonl.gz"), \
             patch("first_printings.urllib.request.urlopen", return_value=FakeResponse(gz_bytes)):
            download_default_cards(dest)

        assert dest.read_bytes() == gz_bytes

    def test_downloaded_file_is_readable_by_load_first_printings(self, tmp_path):
        recs = [printing("abc", "Revised", "1994-04-11"), printing("abc", "Alpha", "1993-08-05")]
        gz_bytes = gzip.compress(("\n".join(json.dumps(r) for r in recs)).encode("utf-8"))
        dest = tmp_path / "default-cards.jsonl.gz"

        with patch("first_printings.fetch_bulk_download_url", return_value="https://x/y.jsonl.gz"), \
             patch("first_printings.urllib.request.urlopen", return_value=FakeResponse(gz_bytes)):
            download_default_cards(dest)

        assert load_first_printings(dest)["abc"]["set_name"] == "Alpha"

    def test_requests_the_default_cards_bulk_type(self, tmp_path):
        gz_bytes = gzip.compress(b"")
        with patch("first_printings.fetch_bulk_download_url",
                   return_value="https://x/y.jsonl.gz") as resolver, \
             patch("first_printings.urllib.request.urlopen", return_value=FakeResponse(gz_bytes)):
            download_default_cards(tmp_path / "out.jsonl.gz")

        resolver.assert_called_once_with("default_cards")

    def test_partial_download_leaves_no_file_behind(self, tmp_path):
        class ExplodingResponse(FakeResponse):
            def read(self, size=-1):
                raise OSError("connection reset")

        dest = tmp_path / "default-cards.jsonl.gz"
        with patch("first_printings.fetch_bulk_download_url", return_value="https://x/y.jsonl.gz"), \
             patch("first_printings.urllib.request.urlopen", return_value=ExplodingResponse(b"")):
            with pytest.raises(OSError):
                download_default_cards(dest)

        assert not dest.exists()
        assert list(tmp_path.iterdir()) == []
