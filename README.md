# WorldClockX (Flask + SSE World Clock Dashboard)

WorldClockX is a Flask web app that shows accurate world time with:
- Live analog dial + digital clock + date
- World time grid (major time zones)
- Search by Country and Search by City (autocomplete)
- Server-Sent Events (SSE) streaming updates every second
- Country/City theme effects via `static/themes/themes.json`

## Tech
- Backend: Flask (Python)
- Timezones: IANA via `zoneinfo`
- Streaming: Server-Sent Events (SSE)

## Setup (macOS / Linux)
```bash
cd worldclockx
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PORT=5050 python app.py

👨‍💻 Author

Built by Raja Abimanyu N
Data Scientist | AI Engineer | Applied ML & Decision Systems
