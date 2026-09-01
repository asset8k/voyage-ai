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
