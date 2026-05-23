from pydantic import BaseModel, Field


class GenerateJournalRequest(BaseModel):
    image_ids: list[int] = Field(..., min_length=1)
    title: str | None = None


class JournalJobAccepted(BaseModel):
    job_id: int
    status: str


class JournalSkippedImage(BaseModel):
    image_id: int
    reason: str  # standardized ERROR_CODE (see Feature 5 in Step 4)


class JournalProgress(BaseModel):
    done: int
    total: int


class JournalJobStatus(BaseModel):
    job_id: int
    status: str
    journal_id: int | None = None
    progress: JournalProgress | None = None
    entries_created: int | None = None
    skipped: list[JournalSkippedImage] | None = None
    error: str | None = None
