"""
anpr/plate_dedup.py

Plate-level deduplication: prevents the same plate string being reported
dozens of times during a single vehicle passage.

Each unique plate is reported at most once per ``cooldown_seconds`` window.
"""

import time


class PlateDeduplicator:
    """
    Reports a plate at most once per ``cooldown`` seconds.

    Usage::

        dedup = PlateDeduplicator(cooldown_seconds=10.0)

        if dedup.is_new(plate):
            emit(plate)   # first time (or cooldown expired)
    """

    def __init__(self, cooldown_seconds: float = 10.0):
        self.cooldown = cooldown_seconds
        self._seen: dict[str, float] = {}

    def is_new(self, plate: str) -> bool:
        """
        Return ``True`` and record the plate if it has not been seen within
        the cooldown window.  Return ``False`` if it was seen recently.
        """
        now = time.time()
        last = self._seen.get(plate, 0.0)
        if now - last >= self.cooldown:
            self._seen[plate] = now
            return True
        return False

    def purge_expired(self) -> None:
        """Remove entries whose cooldown has expired (optional housekeeping)."""
        now = time.time()
        self._seen = {
            p: t for p, t in self._seen.items() if now - t < self.cooldown
        }
