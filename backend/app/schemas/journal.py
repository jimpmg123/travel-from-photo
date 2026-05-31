from datetime import datetime

from pydantic import BaseModel, Field


# ----- Generate / job status -----

class GenerateJournalRequest(BaseModel):
    image_ids: list[int] = Field(..., min_length=1)
    title: str | None = None


class JournalJobAccepted(BaseModel):
    job_id: int
    status: str


class JournalSkippedImage(BaseModel):
    image_id: int
    reason: str  # standardized ERROR_CODE


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


# ----- Entry / Journal read models -----

class JournalEntryResponse(BaseModel):
    id: int
    image_id: int
    image_url: str | None = None
    entry_order: int
    place_name: str | None = None
    country: str | None = None
    city: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    captured_at: datetime | None = None
    clip_subject: list[str] | None = None
    clip_atmosphere: list[str] | None = None
    clip_activity: list[str] | None = None
    gpt_shooting_style: str | None = None
    gpt_subject_focus: str | None = None
    gpt_time_of_day: str | None = None
    gpt_atmosphere: str | None = None
    gpt_weather_light: str | None = None
    gpt_composition_habit: str | None = None
    gpt_color_mood: str | None = None
    gpt_cultural_layer: str | None = None
    gpt_detail_note: str | None = None
    journal_text: str | None = None
    generated_by: str
    model_version: str | None = None
    vocab_version: str | None = None
    generated_at: datetime


class JournalSummary(BaseModel):
    """Compact row for the collections list."""
    id: int
    title: str | None = None
    status: str
    primary_city: str | None = None
    primary_country: str | None = None
    entry_count: int
    earliest_captured_at: datetime | None = None
    created_at: datetime
    cover_image_url: str | None = None


class JournalDetailResponse(BaseModel):
    id: int
    title: str | None = None
    summary: str | None = None
    status: str
    visibility: str
    error_reason: str | None = None
    skipped: list[JournalSkippedImage] | None = None
    created_at: datetime
    updated_at: datetime
    entries: list[JournalEntryResponse]


# ----- Mutations -----

class JournalEntryEdit(BaseModel):
    id: int
    journal_text: str | None = None


class JournalEditRequest(BaseModel):
    title: str | None = None
    entries: list[JournalEntryEdit] | None = None


# ----- Stats / recommendations -----

class JournalStatsResponse(BaseModel):
    photo_count: int
    country_count: int
    city_count: int
    countries: list[str]
    cities: list[str]
    total_distance_km: float
    subject_distribution: dict[str, int]
    atmosphere_distribution: dict[str, int]
    activity_distribution: dict[str, int]
    cultural_layer_distribution: dict[str, int]
    color_mood_distribution: dict[str, int]
    composition_distribution: dict[str, int]
    time_of_day_distribution: dict[str, int]


class RecommendationItem(BaseModel):
    name: str
    country: str
    reason: str


class JournalRecommendationsResponse(BaseModel):
    recommendations: list[RecommendationItem]
    low_data: bool
    model_version: str | None = None
