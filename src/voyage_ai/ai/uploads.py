from collections.abc import Sequence
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile, status

ALLOWED_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "application/pdf",
    }
)

MAX_UPLOADS = 3
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

FILE_SIGNATURES: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "application/pdf": b"%PDF-",
}


@dataclass(frozen=True, slots=True)
class UploadedAttachment:
    filename: str
    content_type: str
    content: bytes


async def validate_uploads(
    files: Sequence[UploadFile],
) -> list[UploadedAttachment]:
    if len(files) > MAX_UPLOADS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You can upload at most {MAX_UPLOADS}",
        )

    attachments: list[UploadedAttachment] = []

    for file in files:
        content_type = file.content_type

        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only JPG, PNG, and PDF files are supported.",
            )

        content = await file.read(MAX_FILE_SIZE_BYTES + 1)

        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded files cannot be empty.",
            )

        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Each uploaded file must be 10 MB or smaller.",
            )

        if not content.startswith(FILE_SIGNATURES[content_type]):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file does not match its declared type.",
            )

        attachments.append(
            UploadedAttachment(
                filename=file.filename or "attachment",
                content_type=content_type,
                content=content,
            )
        )

    return attachments
