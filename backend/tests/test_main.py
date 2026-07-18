def test_version_endpoint_unauthenticated(client):
    """"Обновление доступно" баннер (2026-07-18) поллит это без токена — публично,
    не несёт ничего чувствительного, см. CLAUDE.md."""
    resp = client.get("/api/version")
    assert resp.status_code == 200
    assert isinstance(resp.json()["version"], str)
    assert resp.json()["version"]


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
