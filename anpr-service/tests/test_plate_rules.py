"""
Tests for anpr/plate_rules.py

Covers:
- Standard Indian plate format acceptance
- BH-series plate acceptance
- OCR misread correction (segment-aware)
- Garbage / too-short strings are rejected
- re.fullmatch enforcement (no partial matches)
"""

import pytest
from anpr.plate_rules import normalize_plate


class TestStandardFormats:
    """Plates that should be accepted without any correction (Pass 1)."""

    def test_10_char_two_letter_series(self):
        assert normalize_plate("KA01AB1234") == "KA01AB1234"

    def test_9_char_one_letter_series(self):
        assert normalize_plate("MH02A5678") == "MH02A5678"

    def test_9_char_single_digit_district(self):
        assert normalize_plate("TN1AB1234") == "TN1AB1234"

    def test_8_char_single_digit_district_single_series(self):
        assert normalize_plate("KA1A1234") == "KA1A1234"

    def test_8_char_no_series_letters(self):
        assert normalize_plate("KA011234") == "KA011234"

    def test_whitespace_stripped(self):
        assert normalize_plate("KA 01 AB 1234") == "KA01AB1234"

    def test_hyphens_stripped(self):
        assert normalize_plate("KA-01-AB-1234") == "KA01AB1234"


class TestBHSeries:
    """BH-series (Bharat) plates introduced in 2021."""

    def test_bh_two_letter_suffix(self):
        assert normalize_plate("23BH1234AA") == "23BH1234AA"

    def test_bh_one_letter_suffix(self):
        assert normalize_plate("23BH1234A") == "23BH1234A"

    def test_bh_year_digit_correction(self):
        # OCR may read 'O' for '0' in the year digits
        # 'O3BH1234AA' -> DIGIT_MAP 'O'->0 at digit position 0 -> '03BH1234AA'
        assert normalize_plate("O3BH1234AA") == "03BH1234AA"


class TestOCRCorrections:
    """Plates that require segment-aware OCR correction (Pass 2)."""

    def test_I_in_digit_position(self):
        # KA0IAB1234 -> position 3 is digit, I->1 via DIGIT_MAP
        assert normalize_plate("KA0IAB1234") == "KA01AB1234"

    def test_8_in_letter_series_position(self):
        # KA01A81234 -> position 5 is letter, 8->B via LETTER_MAP
        assert normalize_plate("KA01A81234") == "KA01AB1234"

    def test_O_in_digit_position(self):
        # KAO1AB1234 -> position 2 is digit, O->0 via DIGIT_MAP
        assert normalize_plate("KAO1AB1234") == "KA01AB1234"

    def test_0_in_state_letter_position(self):
        # 0A01AB1234 -> position 0 is letter, 0->O via LETTER_MAP
        assert normalize_plate("0A01AB1234") == "OA01AB1234"

    def test_S_in_digit_position(self):
        # KA0SAB1234 -> position 3 is digit, S->5 via DIGIT_MAP
        assert normalize_plate("KA0SAB1234") == "KA05AB1234"

    def test_G_in_digit_position(self):
        # MH02AB123G -> position 9 is digit, G->6 via DIGIT_MAP
        assert normalize_plate("MH02AB123G") == "MH02AB1236"


class TestRejections:
    """Strings that should never produce a plate match."""

    def test_garbage_word(self):
        assert normalize_plate("HELLO WORLD") == ""

    def test_all_digits(self):
        assert normalize_plate("12345678") == ""

    def test_too_short(self):
        assert normalize_plate("KA01") == ""

    def test_empty_string(self):
        assert normalize_plate("") == ""

    def test_symbols_only(self):
        assert normalize_plate("!@#$%^") == ""


class TestFullmatchEnforcement:
    """Verify re.fullmatch is used (no substring / partial matching)."""

    def test_garbage_prefix_not_matched(self):
        # Old re.search would match "KA01AB1234" within this string
        assert normalize_plate("XYKA01AB1234XX") == ""

    def test_garbage_suffix_not_matched(self):
        assert normalize_plate("KA01AB1234ZZZ") == ""

    def test_leading_digits_not_matched_as_state(self):
        # "12KA01AB1234" has valid plate embedded but is 12 chars — no pattern matches 12 chars
        assert normalize_plate("12KA01AB1234") == ""
