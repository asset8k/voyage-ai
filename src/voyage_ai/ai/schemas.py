from datetime import date
from math import isclose
from typing import Self

from pydantic import BaseModel, Field, model_validator

from voyage_ai.places.schemas import ResolvedPlace


class Activity(BaseModel):
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    name: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=512)
    location: str = Field(min_length=1, max_length=120)
    map_queries: list[str] = Field(default_factory=list, max_length=2)
    category: str = Field(min_length=1, max_length=64)
    estimated_cost: float = Field(ge=0)
    travel_time_to_next: str | None = Field(default=None, max_length=64)
    resolved_places: list[ResolvedPlace] = Field(
        default_factory=list,
        max_length=2,
    )


class DayPlan(BaseModel):
    day: int = Field(gt=0)
    date: date
    title: str = Field(min_length=1, max_length=64)
    weather_note: str | None = Field(default=None, max_length=256)
    activities: list[Activity] = Field(min_length=1)
    estimated_daily_cost: float = Field(ge=0)

    @model_validator(mode="after")
    def validate_daily_cost(self) -> Self:

        if self.estimated_daily_cost < sum(
            activity.estimated_cost for activity in self.activities
        ):
            raise ValueError(
                "estimated_daily_cost must be greater than or equal to the sum of activity estimated_cost values"
            )

        return self


class BudgetBreakdown(BaseModel):
    accommodation: float = Field(ge=0)
    food: float = Field(ge=0)
    transport: float = Field(ge=0)
    activities: float = Field(ge=0)
    other: float = Field(ge=0)
    total: float = Field(gt=0)

    @model_validator(mode="after")
    def validate_total(self) -> Self:
        expenses_total = (
            self.accommodation
            + self.food
            + self.transport
            + self.activities
            + self.other
        )

        if not isclose(expenses_total, self.total, abs_tol=0.01):
            raise ValueError("total must equal the sum of all budget categories")
        return self


class TripPlan(BaseModel):
    # POST /api/trips/generate
    destination: str = Field(min_length=1, max_length=120)
    trip_summary: str = Field(min_length=1, max_length=1024)
    days: list[DayPlan] = Field(min_length=1)
    budget: BudgetBreakdown
    recommendations: list[str]
    warnings: list[str]
    packing_tips: list[str]
    assumptions: list[str]
    currency: str = Field(pattern=r"^[A-Z]{3}$")

    @model_validator(mode="after")
    def validate_total_matches_days(self) -> Self:

        if not isclose(
            self.budget.total,
            sum(day.estimated_daily_cost for day in self.days),
            abs_tol=0.01,
        ):
            raise ValueError(
                "budget.total must be equal to the sum of estimated_daily_cost values"
            )

        return self
