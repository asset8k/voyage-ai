from datetime import date

from voyage_ai.ai.schemas import (
    Activity,
    BudgetBreakdown,
    DayPlan,
    TripPlan,
)


def test_trip_plan_serializes() -> None:
    activity = Activity(
        start_time="09:00",
        end_time="11:00",
        name="Senso-ji Temple",
        description="Visit Tokyo's historic Buddhist temple.",
        location="Asakusa, Tokyo",
        category="sightseeing",
        estimated_cost=0,
    )

    day = DayPlan(
        day=1,
        date=date(2026, 10, 10),
        title="Arrival and Asakusa",
        activities=[activity],
        estimated_daily_cost=80,
    )

    budget = BudgetBreakdown(
        accommodation=700,
        food=350,
        transport=120,
        activities=250,
        other=80,
        total=1500,
    )

    trip_plan = TripPlan(
        destination="Tokyo",
        trip_summary="A five-day Tokyo trip focused on food and culture.",
        days=[day],
        budget=budget,
        recommendations=["Book popular restaurants in advance."],
        warnings=["Keep a small amount of cash available."],
        packing_tips=["Comfortable walking shoes."],
        assumptions=["Costs are estimates for two travellers."],
        estimated_total_cost=1500,
        currency="USD",
    )

    result = trip_plan.model_dump(mode="json")

    assert result["destination"] == "Tokyo"
    assert result["days"][0]["date"] == "2026-10-10"
    assert result["budget"]["total"] == 1500
