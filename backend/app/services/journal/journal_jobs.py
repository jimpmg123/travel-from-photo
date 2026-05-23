"""Background task entry points for asynchronous Journal generation.

This module is intentionally thin in Step 2 — it just transitions the Journal
status through pending -> processing -> done so the endpoint contract can be
exercised end-to-end. The real CLIP + Places + GPT pipeline lands in Step 3.
"""
from __future__ import annotations

import logging
import time

from app.core.db import SessionLocal
from app.models.journal import (
    JOURNAL_STATUS_DONE,
    JOURNAL_STATUS_FAILED,
    JOURNAL_STATUS_PROCESSING,
    Journal,
)

logger = logging.getLogger(__name__)

# Step-2 stub only. The real pipeline (Step 3) will accept image_ids and write
# JournalEntry rows; for now we just walk the journal status through the happy
# path so polling works.
STUB_PROCESSING_DELAY_SECONDS = 1.0


def process_journal_job(journal_id: int, image_ids: list[int]) -> None:
    db = SessionLocal()
    try:
        journal = db.get(Journal, journal_id)
        if journal is None:
            logger.warning("process_journal_job: journal %d not found", journal_id)
            return

        journal.status = JOURNAL_STATUS_PROCESSING
        db.commit()

        # TODO Step 3: replace this stub with the real pipeline run.
        time.sleep(STUB_PROCESSING_DELAY_SECONDS)

        journal.status = JOURNAL_STATUS_DONE
        db.commit()

    except Exception as exc:  # noqa: BLE001 — capture all to record on Journal
        logger.exception("process_journal_job: job %d failed", journal_id)
        try:
            db.rollback()
            journal = db.get(Journal, journal_id)
            if journal is not None:
                journal.status = JOURNAL_STATUS_FAILED
                journal.error_reason = str(exc)[:500]
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
