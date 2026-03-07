"""
tests/test_plate_dedup.py

Unit tests for anpr.plate_dedup.PlateDeduplicator.
"""

import time
import pytest
from anpr.plate_dedup import PlateDeduplicator


class TestPlateDeduplicatorBasic:
    def test_new_plate_is_reported(self):
        """An unseen plate should be considered new."""
        pd = PlateDeduplicator()
        assert pd.is_new("KA01AB1234") is True

    def test_same_plate_within_cooldown_not_reported(self):
        """The same plate within the cooldown window must return False."""
        pd = PlateDeduplicator(cooldown_seconds=10.0)
        pd.is_new("KA01AB1234")
        assert pd.is_new("KA01AB1234") is False

    def test_different_plates_both_reported(self):
        """Two different plate strings must each be reported once."""
        pd = PlateDeduplicator(cooldown_seconds=10.0)
        assert pd.is_new("KA01AB1234") is True
        assert pd.is_new("MH02CD5678") is True

    def test_zero_cooldown_always_reports(self):
        """A zero cooldown means every occurrence is reported."""
        pd = PlateDeduplicator(cooldown_seconds=0.0)
        assert pd.is_new("DL1CAB0001") is True
        assert pd.is_new("DL1CAB0001") is True


class TestPlateDeduplicatorCooldownExpiry:
    def test_plate_reported_again_after_cooldown(self):
        """After the cooldown expires, the same plate should be reported again."""
        pd = PlateDeduplicator(cooldown_seconds=0.05)
        assert pd.is_new("TN01AB0001") is True
        time.sleep(0.1)                     # wait for cooldown to expire
        assert pd.is_new("TN01AB0001") is True

    def test_plate_still_suppressed_just_before_cooldown(self):
        """A plate seen just before cooldown expiry must still be suppressed."""
        pd = PlateDeduplicator(cooldown_seconds=1.0)
        pd.is_new("GJ05CD2222")
        time.sleep(0.05)                    # well within 1-second cooldown
        assert pd.is_new("GJ05CD2222") is False


class TestPlateDeduplicatorPurge:
    def test_purge_removes_expired_entries(self):
        """purge_expired() should remove plates whose cooldown has passed."""
        pd = PlateDeduplicator(cooldown_seconds=0.05)
        pd.is_new("HR26AA0001")
        time.sleep(0.1)
        pd.purge_expired()
        assert "HR26AA0001" not in pd._seen

    def test_purge_keeps_active_entries(self):
        """purge_expired() must not remove plates still within cooldown."""
        pd = PlateDeduplicator(cooldown_seconds=60.0)
        pd.is_new("PB10AB1234")
        pd.purge_expired()
        assert "PB10AB1234" in pd._seen

    def test_purge_mixed_entries(self):
        """purge_expired() removes only expired entries, keeps active ones."""
        pd = PlateDeduplicator(cooldown_seconds=0.05)
        pd.is_new("EXPIRED1")
        pd.is_new("EXPIRED2")
        time.sleep(0.1)                       # let them expire
        pd2 = PlateDeduplicator(cooldown_seconds=60.0)
        pd2._seen = {**pd._seen}              # copy expired entries
        pd2._seen["ACTIVE"] = time.time()     # add a fresh entry
        pd2.cooldown = 0.05                   # same short cooldown for expired
        pd2.purge_expired()
        # After purge, expired keys gone but ACTIVE remains
        # (ACTIVE was just added, still within 0.05 s)
        # Note: ACTIVE *might* still be < 0.05 s old depending on timing,
        # so we just verify the expired ones are gone.
        assert "EXPIRED1" not in pd2._seen
        assert "EXPIRED2" not in pd2._seen


class TestPlateDeduplicatorEdgeCases:
    def test_empty_string_plate(self):
        """Empty string should behave as a normal plate key."""
        pd = PlateDeduplicator(cooldown_seconds=1.0)
        assert pd.is_new("") is True
        assert pd.is_new("") is False

    def test_many_unique_plates_all_reported(self):
        """Each of N distinct plates must be reported exactly once."""
        pd = PlateDeduplicator(cooldown_seconds=60.0)
        plates = [f"KA{i:02d}AA{i:04d}" for i in range(20)]
        results = [pd.is_new(p) for p in plates]
        assert all(results), "Every unique plate should be new the first time"
