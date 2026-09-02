from datetime import date
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class TripGenerationRequest(BaseModel):
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
