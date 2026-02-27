from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

DATA_FILE = DATA_DIR / "countries_cities_timezones.json"
THEMES_FILE = STATIC_DIR / "themes" / "themes.json"

# World times grid (you can add more)
WORLD_TZ_DEFAULT = [
    "UTC",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Australia/Sydney",
    "Pacific/Auckland",
]


@dataclass(frozen=True)
class CityRecord:
    country: str
    city: str
    tz: str


def create_app() -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")

    countries, cities = _load_country_city_data(DATA_FILE)
    themes = _load_json(THEMES_FILE, default={})

    app.config["COUNTRIES_LIST"] = countries
    app.config["CITIES_LIST"] = cities
    app.config["THEMES"] = themes

    # ---------------- UI ----------------
    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/dashboard")
    def dashboard():
        return render_template("dashboard.html", countries=countries)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    # ---------------- API ----------------
    @app.get("/api/time")
    def api_time():
        tz = request.args.get("tz", "").strip()
        if not tz:
            return _err(400, "Missing tz parameter. Example: /api/time?tz=Asia/Kolkata")
        try:
            payload = _time_payload_for_tz(tz)
        except ZoneInfoNotFoundError:
            return _err(400, f"Invalid timezone: {tz}")
        return jsonify(payload)

    @app.get("/api/world_times")
    def api_world_times():
        out: List[Dict[str, Any]] = []
        for tz in WORLD_TZ_DEFAULT:
            try:
                out.append(_time_payload_for_tz(tz))
            except ZoneInfoNotFoundError:
                continue
        return jsonify({"items": out})

    @app.get("/api/search/country")
    def api_search_country():
        return jsonify({"countries": countries})

    @app.get("/api/search/country/<country>")
    def api_search_country_cities(country: str):
        country_norm = country.strip().lower()
        filtered = [
            {"city": r.city, "tz": r.tz}
            for r in cities
            if r.country.lower() == country_norm
        ]
        if not filtered:
            return _err(404, f"No cities found for country: {country}")
        filtered = sorted(filtered, key=lambda x: x["city"].lower())
        return jsonify({"country": country, "cities": filtered})

    @app.get("/api/search/city")
    def api_search_city():
        q = request.args.get("q", "").strip().lower()
        if len(q) < 2:
            return jsonify({"q": q, "results": []})

        results = []
        for r in cities:
            hay = f"{r.city} {r.country}".lower()
            if q in hay:
                results.append({"city": r.city, "country": r.country, "tz": r.tz})

        return jsonify({"q": q, "results": results[:15]})

    @app.get("/api/theme")
    def api_theme():
        country = (request.args.get("country") or "").strip()
        city = (request.args.get("city") or "").strip()

        themes_obj: Dict[str, Any] = themes
        default_theme = themes_obj.get("__default__", {})
        city_theme = themes_obj.get("cities", {}).get(city, {})
        country_theme = themes_obj.get("countries", {}).get(country, {})

        merged = {**default_theme, **country_theme, **city_theme}
        return jsonify({"country": country, "city": city, "theme": merged})

    # ✅ NEW: Accurate resolver endpoint (Country + City -> tz + time)
    @app.get("/api/resolve")
    def api_resolve():
        country = (request.args.get("country") or "").strip()
        city = (request.args.get("city") or "").strip()

        if not country or not city:
            return _err(400, "Missing country/city. Use /api/resolve?country=...&city=...")

        country_low = country.lower()
        city_low = city.lower()

        match: CityRecord | None = None
        for r in cities:
            if r.country.lower() == country_low and r.city.lower() == city_low:
                match = r
                break

        if not match:
            return _err(404, f"Could not resolve timezone for {country} / {city}")

        try:
            ZoneInfo(match.tz)
        except ZoneInfoNotFoundError:
            return _err(500, f"Timezone not supported on this system: {match.tz}")

        payload = _time_payload_for_tz(match.tz)
        payload.update({"country": match.country, "city": match.city})
        return jsonify(payload)

    # ---------------- SSE ----------------
    @app.get("/stream/time")
    def stream_time():
        tz = request.args.get("tz", "").strip()
        if not tz:
            return Response("Missing tz", status=400)

        try:
            ZoneInfo(tz)
        except ZoneInfoNotFoundError:
            return Response("Invalid timezone", status=400)

        @stream_with_context
        def event_stream():
            while True:
                payload = _time_payload_for_tz(tz)
                yield f"event: tick\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                time.sleep(1)

        return Response(
            event_stream(),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app


# ---------------- Utilities ----------------
def _time_payload_for_tz(tz: str) -> Dict[str, Any]:
    now = datetime.now(ZoneInfo(tz))
    return {
        "tz": tz,
        "iso": now.isoformat(),
        "date": now.strftime("%a, %d %b %Y"),
        "time": now.strftime("%H:%M:%S"),
        "year": now.year,
        "month": now.month,
        "day": now.day,
        "hour": now.hour,
        "minute": now.minute,
        "second": now.second,
        "offset": now.strftime("%z"),
    }


def _err(status: int, message: str):
    return jsonify({"error": {"status": status, "message": message}}), status


def _load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _load_country_city_data(path: Path) -> Tuple[List[str], List[CityRecord]]:
    obj = _load_json(path, {"items": []})
    items = obj.get("items", [])

    countries: List[str] = []
    cities: List[CityRecord] = []

    for entry in items:
        country = (entry.get("country") or "").strip()
        if not country:
            continue
        countries.append(country)
        for c in entry.get("cities", []):
            city = (c.get("city") or "").strip()
            tz = (c.get("tz") or "").strip()
            if city and tz:
                cities.append(CityRecord(country=country, city=city, tz=tz))

    countries = sorted(set(countries), key=lambda x: x.lower())
    # de-duplicate
    cities = list({(r.country, r.city, r.tz): r for r in cities}.values())
    return countries, cities


# ---------------- App Start ----------------
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))  # ✅ default 5050 (avoids port 5000 issues)
    debug_mode = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)