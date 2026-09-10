from pydantic import BaseModel, Field


class ResolvedPlace(BaseModel):
    provider: str = Field(default="google_places")
    place_id: str = Field(min_length=1, max_length=255)
    name: str = Field(min_length=1, max_length=255)
    formatted_address: str | None = Field(default=None, max_length=512)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    photo_reference: str | None = Field(default=None, max_length=512)
