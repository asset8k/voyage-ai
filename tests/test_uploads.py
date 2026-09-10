from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile, status
from starlette.datastructures import Headers

from voyage_ai.ai.uploads import (
    MAX_FILE_SIZE_BYTES,
    MAX_UPLOADS,
    validate_uploads,
)


def make_upload(
    filename: str,
    content_type: str,
    content: bytes,
) -> UploadFile:
    return UploadFile(
        filename=filename,
        file=BytesIO(content),
        headers=Headers({"content-type": content_type}),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("filename", "content_type", "content"),
    [
        ("photo.jpg", "image/jpeg", b"\xff\xd8\xffimage-content"),
        ("photo.png", "image/png", b"\x89PNG\r\n\x1a\nimage-content"),
        ("booking.pdf", "application/pdf", b"%PDF-1.7 pdf-content"),
    ],
)
async def test_validate_uploads_accepts_supported_files(
    filename: str,
    content_type: str,
    content: bytes,
) -> None:
    upload = make_upload(filename, content_type, content)

    attachments = await validate_uploads([upload])

    assert len(attachments) == 1
    assert attachments[0].filename == filename
    assert attachments[0].content_type == content_type
    assert attachments[0].content == content


@pytest.mark.asyncio
async def test_validate_uploads_rejects_too_many_files() -> None:
    upload = make_upload("photo.jpg", "image/jpeg", b"\xff\xd8\xffimage-content")

    with pytest.raises(HTTPException) as exc_info:
        await validate_uploads([upload] * (MAX_UPLOADS + 1))

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_validate_uploads_rejects_unsupported_type() -> None:
    upload = make_upload("notes.txt", "text/plain", b"Some notes")

    with pytest.raises(HTTPException) as exc_info:
        await validate_uploads([upload])

    assert exc_info.value.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE


@pytest.mark.asyncio
async def test_validate_uploads_rejects_empty_file() -> None:
    upload = make_upload("photo.jpg", "image/jpeg", b"")

    with pytest.raises(HTTPException) as exc_info:
        await validate_uploads([upload])

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_validate_uploads_rejects_file_that_is_too_large() -> None:
    content = b"\xff\xd8\xff" + (b"a" * MAX_FILE_SIZE_BYTES)
    upload = make_upload("large-photo.jpg", "image/jpeg", content)

    with pytest.raises(HTTPException) as exc_info:
        await validate_uploads([upload])

    assert exc_info.value.status_code == status.HTTP_413_CONTENT_TOO_LARGE


@pytest.mark.asyncio
async def test_validate_uploads_rejects_mismatched_content_type() -> None:
    upload = make_upload(
        "not-really-a-jpeg.jpg",
        "image/jpeg",
        b"%PDF-1.7 pdf-content",
    )

    with pytest.raises(HTTPException) as exc_info:
        await validate_uploads([upload])

    assert exc_info.value.status_code == status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
