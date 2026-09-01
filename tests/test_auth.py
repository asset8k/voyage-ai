import pytest


@pytest.fixture
def registered_user(client):
    credentials = {
        "username": "assetk",
        "password": "securepassword123",
    }
    response = client.post("/api/auth/register", json=credentials)
    assert response.status_code == 201
    return credentials


@pytest.fixture
def access_token(client, registered_user):
    response = client.post("/api/auth/login", json=registered_user)
    assert response.status_code == 200
    return response.json()["access_token"]


def test_register_user(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "assetk",
            "password": "securepassword123",
        },
    )

    assert response.status_code == 201

    body = response.json()
    assert body["username"] == "assetk"
    assert "id" in body
    assert "created_at" in body
    assert "password_hash" not in body


def test_duplicate_username(client, registered_user):
    response = client.post(
        "/api/auth/register",
        json=registered_user,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Username already exists"


def test_login_user(client, registered_user):
    response = client.post(
        "/api/auth/login",
        json=registered_user,
    )

    assert response.status_code == 200

    body = response.json()

    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, registered_user):
    response = client.post(
        "/api/auth/login",
        json={
            **registered_user,
            "password": "wrong123",
        },
    )

    assert response.status_code == 401


def test_get_current_user_without_token(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_get_current_user_with_valid_token(client, registered_user, access_token):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200

    body = response.json()
    assert body["username"] == registered_user["username"]
    assert "id" in body
    assert "created_at" in body
    assert "password_hash" not in body


def test_get_current_user_with_invalid_token(client):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-valid-jwt"},
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    "payload",
    [
        {"username": "ab", "password": "securepassword123"},
        {"username": "AssetK", "password": "securepassword123"},
        {"username": "assetk", "password": "short"},
    ],
)
def test_register_rejects_invalid_input(client, payload):
    response = client.post("/api/auth/register", json=payload)

    assert response.status_code == 422


def test_login_unknown_username(client):
    response = client.post(
        "/api/auth/login",
        json={
            "username": "irmao",
            "password": "securepassword123",
        },
    )

    assert response.status_code == 401
