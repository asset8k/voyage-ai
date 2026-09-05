from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from voyage_ai.ai.schemas import TripPlan
from voyage_ai.users.schemas import UserPublic


class TripGenerationRequest(BaseModel):
    # POST /api/trips/generate
    destination: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    budget: Decimal = Field(gt=0)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    travellers: int = Field(ge=1)
    travel_pace: Literal["relaxed", "balanced", "fast"]
    preferences: str = Field(min_length=1, max_length=1024)

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class TripCreate(BaseModel):
    # POST /api/trips
    title: str | None = Field(default=None, min_length=1, max_length=160)
    generation_request: TripGenerationRequest
    trip_plan: TripPlan


class TripUpdate(BaseModel):
    # PATCH /api/trips

    title: str | None = Field(default=None, min_length=1, max_length=160)
    is_public: bool | None = None

    @model_validator(mode="after")
    def validate_has_update(self) -> Self:
        if self.title is None and self.is_public is None:
            raise ValueError("At least one field must be provided")
        return self


class TripDetail(BaseModel):
    # POST /api/trips response
    # GET /api/trips/{trip_id} response
    # PATCH /api/trips/{trip_id} response

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    destination: str
    start_date: date
    end_date: date
    trip_plan: TripPlan
    is_public: bool
    created_at: datetime
    updated_at: datetime


class TripListItem(BaseModel):
    # Each item inside GET /api/trips/mine

    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    destination: str
    start_date: date
    end_date: date
    is_public: bool
    created_at: datetime
    updated_at: datetime


class TripFeedItem(BaseModel):
    # Each item inside GET /api/feed/trips

    id: int
    title: str
    destination: str
    start_date: date
    end_date: date
    trip_summary: str
    author: UserPublic
    created_at: datetime
