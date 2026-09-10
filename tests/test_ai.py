import base64
import json

from voyage_ai.ai.planner import build_generation_input
from voyage_ai.ai.uploads import UploadedAttachment
from voyage_ai.trips.schemas import TripGenerationRequest


def make_trip_request() -> TripGenerationRequest:
    return TripGenerationRequest(
        destination="Tokyo",
        start_date="2026-10-10",
        end_date="2026-10-12",
        budget=1000,
        currency="USD",
        travellers=1,
        travel_pace="balanced",
        preferences="Food and museums",
    )


def test_build_generation_input_without_attachments() -> None:
    request = make_trip_request()

    input_items = build_generation_input(request, [])

    assert len(input_items) == 1
    content = input_items[0]["content"]
    assert len(content) == 1
    assert content[0]["type"] == "input_text"
    assert json.loads(content[0]["text"])["destination"] == "Tokyo"


def test_build_generation_input_encodes_images_and_pdfs() -> None:
    image_content = b"\xff\xd8\xffimage-content"
    pdf_content = b"%PDF-1.7 pdf-content"
    attachments = [
        UploadedAttachment(
            filename="hotel.jpg",
            content_type="image/jpeg",
            content=image_content,
        ),
        UploadedAttachment(
            filename="booking.pdf",
            content_type="application/pdf",
            content=pdf_content,
        ),
    ]

    input_items = build_generation_input(make_trip_request(), attachments)

    content = input_items[0]["content"]
    assert content[1] == {
        "type": "input_image",
        "image_url": (
            "data:image/jpeg;base64,"
            f"{base64.b64encode(image_content).decode('ascii')}"
        ),
        "detail": "auto",
    }
    assert content[2] == {
        "type": "input_file",
        "filename": "booking.pdf",
        "file_data": base64.b64encode(pdf_content).decode("ascii"),
    }
