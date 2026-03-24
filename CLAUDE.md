# CLAUDE.md — mntr-opendev

## Project Overview

**mntr** is a lightweight, real-time data visualization dashboard with encrypted pub/sub architecture. A Flask server serves a React web dashboard and provides an API for publishing data. All data in transit is encrypted end-to-end using AES-256-GCM.

## Tech Stack

- **Backend:** Python 3.10+, Flask 3.0+, Pycryptodome (AES-256-GCM), PyYAML, Requests
- **Frontend:** React 18, Redux Toolkit, Material-UI 6, Chart.js 4, React Grid Layout
- **Dev tools:** Pytest, Mypy, Ruff (lint/format), ESLint, Prettier

## Project Structure

```
mntr/                    # Python package
├── publisher/           # Data publishing (client API, CLI pipe, interval publishers)
│   └── data/impl/       # Data type implementations (plaintext, html, table, chartjs, image, etc.)
├── server/              # Flask server (MntrServer, MntrState)
├── util/                # Encryption utilities
└── web/                 # Built React static assets (output of react_src build)
react_src/               # React frontend source
├── src/components/      # UI components (Login, PanelGrid, Panel, display types)
├── src/state/           # Redux slices (panels, credentials, theme, mobile)
└── src/util/            # API connection, browser-side encryption
demo/                    # Demo configs, example publishers, sample passphrases
```

## Setup

The project virtualenv is `venv.mntr` (not `venv`).

```bash
# Python
source venv.mntr/bin/activate
pip install -e '.[server]'           # server (Flask)
pip install -e '.[publisher]'        # publisher (requests)
pip install -e '.[publisher-extras]' # + matplotlib, pandas
pip install -e '.[dev]'              # all of the above + pytest, mypy, ruff

# React
cd react_src && npm install
npm run build    # outputs to ../mntr/web
```

## Running

```bash
# Server
PYTHONPATH=. venv.mntr/bin/python -m mntr.server \
    --address 0.0.0.0 --port 5100 \
    --client_passphrases demo/passphrases/server.yaml

# Add --store_path /tmp/mntr_store for persistence
# Add --debug for CORS + debug user (password: "debug")

# Example publishers
PYTHONPATH=demo venv.mntr/bin/python -m mntr.publisher.interval_publisher \
    --config demo/examples/config.yaml \
    --server http://localhost:5100 \
    --name client0 --passphrase demo/passphrases/client0.txt

# Pipe publisher
echo "hello" | PYTHONPATH=. venv.mntr/bin/python -m mntr.publisher.pipe \
    --channel my-channel --name client0 \
    --passphrase demo/passphrases/client0.txt \
    --type plaintext --server http://localhost:5100
```

## Testing & Quality

```bash
venv.mntr/bin/pytest                # run all tests
venv.mntr/bin/mypy mntr/            # type checking
venv.mntr/bin/ruff check mntr/      # linting
venv.mntr/bin/ruff format mntr/     # formatting
```

Tests live alongside source code in `test/` subdirectories (e.g., `mntr/server/test/`, `mntr/util/test/`).

## Key Architecture Details

- **Encryption flow:** Publisher encrypts with own passphrase → server decrypts & re-encrypts with subscriber's passphrase → browser decrypts client-side. Passphrases never sent to server.
- **Streaming:** Server-Sent Events (SSE) for real-time dashboard updates.
- **State:** In-memory channel storage with optional JSON file persistence (`MntrState`). No traditional database.
- **Rate limiting:** 10 validation attempts per IP per 60 seconds (configurable) on `/validate`.
- **Name validation:** `^[A-Za-z0-9_\-]{1,64}$` for channel and publisher names.
- **Credentials:** YAML file with `username: passphrase` pairs; `_admins` key lists admin usernames.
- **React build** is bundled into `mntr/web/` and served by Flask — no separate frontend deployment needed.

## Code Conventions

- Python: type hints throughout (Mypy-compatible), NamedTuples for data classes, `logging.getLogger(__name__)`
- React: functional components with hooks, Redux slices pattern, MUI component composition
- Thread-safe state with `threading.Lock` / `threading.Condition`
