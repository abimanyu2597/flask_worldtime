import json
import pytest

from app import create_app

@pytest.fixture()
def client():
    app = create_app()
    app.config.update(TESTING=True)
    return app.test_client()

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"

def test_time_valid(client):
    r = client.get("/api/time?tz=UTC")
    assert r.status_code == 200
    data = r.get_json()
    assert data["tz"] == "UTC"
    assert "time" in data and "date" in data and "iso" in data

def test_time_invalid(client):
    r = client.get("/api/time?tz=Nope/Invalid")
    assert r.status_code == 400
    assert "error" in r.get_json()

def test_country_list(client):
    r = client.get("/api/search/country")
    assert r.status_code == 200
    data = r.get_json()
    assert "countries" in data
    assert isinstance(data["countries"], list)

def test_country_cities(client):
    r = client.get("/api/search/country/India")
    assert r.status_code == 200
    data = r.get_json()
    assert data["country"] == "India"
    assert len(data["cities"]) >= 1
    assert "tz" in data["cities"][0]

def test_city_search(client):
    r = client.get("/api/search/city?q=che")
    assert r.status_code == 200
    data = r.get_json()
    assert "results" in data