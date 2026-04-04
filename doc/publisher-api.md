# Publisher API

The publisher API lets you send data to named channels on a mntr server.
Data is encrypted end-to-end using AES-256-GCM before transmission.

There are three ways to publish:

| Method | Use case |
|---|---|
| [Python client](#python-client) | Programmatic publishing from Python applications |
| [Pipe publisher](#pipe-publisher) | Publish output from shell commands or non-Python programs |
| [Interval publisher](#interval-publisher) | Run publishers on a recurring schedule from a YAML config |

---

## Python client

### Setup

```bash
pip install mntr[publisher]           # core publisher
pip install mntr[publisher-extras]    # + pandas and matplotlib support
```

### Basic usage

```python
from mntr.publisher.client import PublisherClient
from mntr.publisher.data.impl import PlaintextData

client = PublisherClient(
    server="http://localhost:5100",
    name="my-publisher",
    passphrase="my-passphrase",
)

data = PlaintextData(data={"text": "Hello from mntr!"})
client.publish("my-channel", data)
```

The client authenticates automatically on the first `publish()` call and
re-authenticates if the session expires. You can also authenticate explicitly:

```python
client.authenticate()
```

### Channel groups

Channels can be restricted to specific groups. Only users who belong to at
least one of the specified groups (or admin users) can see and subscribe to
the channel. If no groups are specified, the channel is visible to all users.

```python
# Visible only to users in the "ops" or "dev" groups
client.publish("my-channel", data, groups=["ops", "dev"])

# Visible only to user "bob" (every user has an implicit personal group)
client.publish("private-channel", data, groups=["bob"])

# Visible to all users (default)
client.publish("public-channel", data)
```

Groups are configured in the server's passphrases file (see the main README)
and can be managed by admins through the web dashboard.

**Note:** Admins can also set per-channel read and write permissions through
the "Manage Channels" dashboard. Admin-set permissions take precedence over
publisher-set groups. If an admin has configured write permissions on a
channel, only users in the allowed groups can publish to it.

```python
client.authenticate()
```

### Channel and publisher names

Names must match `^[A-Za-z0-9_\-]{1,64}$` (alphanumeric, hyphens, underscores,
1-64 characters).

---

## Content types

Every content type is a subclass of `MonitorData` and produces a JSON payload
with `display_type`, `data`, and an optional `alert`. All types support two
construction styles:

```python
# Explicit
PlaintextData(data={"text": "hello"})

# Factory
PlaintextData.build(text="hello")
```

### Plaintext

Displays plain text. Useful for logs, status messages, command output.

```python
from mntr.publisher.data.impl import PlaintextData

data = PlaintextData(data={"text": "Server started on port 8080"})
client.publish("logs", data)
```

**Required fields:** `text` (str)

**JSON structure:**
```json
{
  "display_type": "plaintext",
  "data": {"text": "Server started on port 8080"},
  "alert": null
}
```

**Pipe equivalent:**
```bash
echo "Server started on port 8080" | python -m mntr.publisher.pipe \
    --type plaintext --channel logs \
    --name my-pub --passphrase pass.txt --server http://localhost:5100
```

**External programs (any language):** publish via the pipe publisher, or construct
the JSON payload and POST it to the server (see [Publishing from external programs](#publishing-from-external-programs)).

### HTML

Displays rendered HTML. Useful for formatted status cards, rich content.

```python
from mntr.publisher.data.impl import HtmlData

html = """
<div style="font-family: monospace">
    <b>Build:</b> #1234<br/>
    <b>Status:</b> <span style="color: green">healthy</span><br/>
    <b>Uptime:</b> 14d 6h
</div>
"""
data = HtmlData(data={"html": html})
client.publish("deploy-status", data)
```

**Required fields:** `html` (str)

**JSON structure:**
```json
{
  "display_type": "html",
  "data": {"html": "<div>...</div>"},
  "alert": null
}
```

**Pipe equivalent:**
```bash
echo '<b>Build #1234</b> — <span style="color:green">OK</span>' \
    | python -m mntr.publisher.pipe --type html --channel deploy \
      --name my-pub --passphrase pass.txt --server http://localhost:5100
```

### Table

Displays a data table. Each row is a dictionary with the same keys (columns).

```python
from mntr.publisher.data.impl import TableData

rows = [
    {"host": "web-01", "cpu": "23%", "memory": "61%", "status": "healthy"},
    {"host": "web-02", "cpu": "45%", "memory": "78%", "status": "healthy"},
    {"host": "db-01",  "cpu": "89%", "memory": "92%", "status": "degraded"},
]
data = TableData(data={"table": rows})
client.publish("service-status", data)
```

**Required fields:** `table` (list of dicts)

**JSON structure:**
```json
{
  "display_type": "table",
  "data": {
    "table": [
      {"host": "web-01", "cpu": "23%", "memory": "61%", "status": "healthy"},
      {"host": "web-02", "cpu": "45%", "memory": "78%", "status": "healthy"}
    ]
  },
  "alert": null
}
```

**From a pandas DataFrame:**
```python
import pandas as pd
from mntr.publisher.data.impl import TableData

df = pd.DataFrame({
    "endpoint": ["/api/users", "/api/orders", "/api/auth"],
    "p50_ms": [45, 120, 30],
    "p99_ms": [230, 890, 150],
    "rpm": [1200, 450, 3400],
})
data = TableData.from_dataframe(df)
client.publish("latency-summary", data)
```

### Charts (Chart.js)

Displays interactive charts rendered by Chart.js in the browser. Five chart
types are supported, each with a factory method.

#### Line chart

Best for time series and trends.

```python
from mntr.publisher.data.impl import ChartJSData

data = ChartJSData.line({
    "labels": ["10:00", "10:05", "10:10", "10:15", "10:20"],
    "datasets": [
        {
            "label": "/api/users",
            "data": [45, 52, 48, 120, 55],
        },
        {
            "label": "/api/orders",
            "data": [110, 105, 130, 125, 115],
        },
    ],
})
client.publish("request-latency", data)
```

**Data format:**
```json
{
  "labels": ["label1", "label2", ...],
  "datasets": [
    {"label": "series name", "data": [number, number, ...]}
  ]
}
```

#### Bar chart

Best for comparing categories.

```python
data = ChartJSData.bar({
    "labels": ["/users", "/orders", "/auth", "/health"],
    "datasets": [
        {"label": "2xx", "data": [1200, 450, 3400, 5000]},
        {"label": "4xx", "data": [23, 12, 89, 0]},
        {"label": "5xx", "data": [2, 0, 5, 0]},
    ],
})
client.publish("traffic", data)
```

#### Scatter chart

Best for correlations and real-time streaming data.

```python
data = ChartJSData.scatter({
    "datasets": [
        {
            "label": "error rate",
            "data": [
                {"x": "10:00", "y": 1.2},
                {"x": "10:05", "y": 0.8},
                {"x": "10:10", "y": 3.5},
            ],
            "showLine": True,   # connect points with a line
        },
    ],
})
client.publish("error-rate", data)
```

**Data format** (differs from line/bar):
```json
{
  "datasets": [
    {
      "label": "series name",
      "data": [{"x": value, "y": value}, ...],
      "showLine": true
    }
  ]
}
```

#### Radar chart

Best for comparing multiple metrics across categories.

```python
data = ChartJSData.radar({
    "labels": ["CPU", "Memory", "Disk I/O", "Network", "Cache Hit"],
    "datasets": [
        {"label": "web-01", "data": [65, 72, 30, 45, 95]},
        {"label": "api-01", "data": [80, 85, 55, 60, 88]},
        {"label": "db-01",  "data": [45, 90, 80, 25, 70]},
    ],
})
client.publish("resource-usage", data)
```

#### Pie chart

Best for proportional breakdowns.

```python
data = ChartJSData.pie({
    "labels": ["200 OK", "301 Redirect", "404 Not Found", "500 Error"],
    "datasets": [
        {
            "label": "responses",
            "data": [12000, 350, 180, 25],
        },
    ],
})
client.publish("status-codes", data)
```

#### Chart.js options

All chart factory methods accept an optional `options` dict passed directly
to Chart.js:

```python
data = ChartJSData.line(chart_data, options={
    "scales": {
        "y": {"beginAtZero": True, "title": {"display": True, "text": "ms"}},
    },
    "plugins": {
        "title": {"display": True, "text": "Response Latency"},
    },
})
```

See the [Chart.js documentation](https://www.chartjs.org/docs/latest/) for
all available options.

**JSON structure (all chart types):**
```json
{
  "display_type": "chartjs",
  "data": {
    "chartjs_type": "line",
    "chartjs_data": {"labels": [...], "datasets": [...]},
    "chartjs_options": {}
  },
  "alert": null
}
```

### Image

Displays a PNG or JPEG image. Useful for matplotlib plots, screenshots,
or any image generated by an external tool.

**From raw bytes (e.g. file or matplotlib buffer):**
```python
from mntr.publisher.data.impl import ImageData

with open("chart.png", "rb") as f:
    data = ImageData.from_bytes(f.read(), image_format="png")
client.publish("chart", data)
```

**From a base64 string:**
```python
data = ImageData.from_base64_string(base64_string, image_format="jpeg")
client.publish("screenshot", data)
```

**From a matplotlib figure:**
```python
import matplotlib.pyplot as plt
from mntr.publisher.data.impl import MatplotlibImageData

fig, ax = plt.subplots()
ax.hist(latencies, bins=50)
ax.axvline(p99, color="red", linestyle="--", label="p99")
ax.legend()

data = MatplotlibImageData.from_figure(fig)  # closes the figure automatically
client.publish("latency-histogram", data)
```

**Required fields:** `image_data_uri` (str, data URI format)

**JSON structure:**
```json
{
  "display_type": "image",
  "data": {"image_data_uri": "data:image/png;base64,iVBOR..."},
  "alert": null
}
```

**Pipe equivalent:**
```bash
# PNG
base64 -w0 chart.png | python -m mntr.publisher.pipe \
    --type png_image --channel chart \
    --name my-pub --passphrase pass.txt --server http://localhost:5100

# JPEG
base64 -w0 photo.jpg | python -m mntr.publisher.pipe \
    --type jpeg_image --channel photo \
    --name my-pub --passphrase pass.txt --server http://localhost:5100
```

### Multi (tabbed panel)

Displays multiple content types in a single panel with tabs. Each tab is
a named `MonitorData` instance.

```python
from mntr.publisher.data.impl import MultiData, PlaintextData, TableData, ChartJSData

data = MultiData({
    "logs": PlaintextData(data={"text": "All systems operational"}),
    "services": TableData(data={"table": [
        {"host": "web-01", "status": "healthy"},
        {"host": "db-01", "status": "healthy"},
    ]}),
    "latency": ChartJSData.line({
        "labels": ["10:00", "10:05", "10:10"],
        "datasets": [{"label": "p50", "data": [45, 48, 52]}],
    }),
})
client.publish("overview", data)
```

**JSON structure:**
```json
{
  "display_type": "multi",
  "data": {
    "logs": {"display_type": "plaintext", "data": {...}, "alert": null},
    "services": {"display_type": "table", "data": {...}, "alert": null},
    "latency": {"display_type": "chartjs", "data": {...}, "alert": null}
  },
  "alert": null
}
```

---

## Alerts

Any content type can include an alert banner. Alerts appear above the content
in the panel.

```python
from mntr.publisher.data import Alert
from mntr.publisher.data.impl import TableData

data = TableData(
    data={"table": [{"host": "db-01", "status": "down", "cpu": "0%"}]},
    alert=Alert(
        severity="error",
        title="Host unreachable",
        message="db-01 has not responded for 30 seconds",
    ),
)
client.publish("service-status", data)
```

**Severities:** `"error"`, `"warning"`, `"info"`, `"success"`

Alerts are optional on all content types. Pass `alert=None` (default) to omit.

---

## Pipe publisher

The pipe publisher reads from stdin and publishes to a channel. It supports
a subset of content types suitable for shell pipelines.

```bash
python -m mntr.publisher.pipe [OPTIONS]
```

| Flag | Required | Default | Description |
|---|---|---|---|
| `-c` / `--channel` | yes | | Channel name |
| `-n` / `--name` | yes | | Publisher name |
| `-p` / `--passphrase` | yes | | Path to file containing passphrase |
| `--server` | yes | | Server URL |
| `-t` / `--type` | no | `plaintext` | Content type (see below) |
| `--groups` | no | | Space-separated list of groups that can access this channel |
| `--ttl` | no | | Time-to-live in seconds |

**Supported types:**

| Type | Stdin format | Display |
|---|---|---|
| `plaintext` | Raw text | Plain text panel |
| `html` | HTML markup | Rendered HTML panel |
| `png_image` | Base64-encoded PNG | Image panel |
| `jpeg_image` | Base64-encoded JPEG | Image panel |

### Examples

```bash
# System info
uname -a | python -m mntr.publisher.pipe \
    -t plaintext -c system-info \
    -n my-pub -p pass.txt --server http://localhost:5100

# Formatted HTML report
cat <<'HTML' | python -m mntr.publisher.pipe \
    -t html -c report \
    -n my-pub -p pass.txt --server http://localhost:5100
<h3>Daily Report</h3>
<ul>
  <li>Requests: 1,234,567</li>
  <li>Errors: 42 (0.003%)</li>
  <li>P99 latency: 230ms</li>
</ul>
HTML

# Screenshot (PNG)
base64 -w0 screenshot.png | python -m mntr.publisher.pipe \
    -t png_image -c screenshots \
    -n my-pub -p pass.txt --server http://localhost:5100

# Matplotlib chart generated by a script
python generate_chart.py | python -m mntr.publisher.pipe \
    -t png_image -c charts \
    -n my-pub -p pass.txt --server http://localhost:5100
```

Where `generate_chart.py` outputs base64-encoded PNG to stdout:

```python
import base64, io, sys
import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.plot([1, 2, 3], [10, 20, 15])
buf = io.BytesIO()
fig.savefig(buf, format="png", bbox_inches="tight")
sys.stdout.write(base64.b64encode(buf.getvalue()).decode())
```

---

## Interval publisher

Runs publishers on a repeating schedule. Each publisher is defined in a YAML
config file and runs in its own process.

```bash
python -m mntr.publisher.interval_publisher [OPTIONS]
```

| Flag | Required | Default | Description |
|---|---|---|---|
| `-c` / `--config` | yes | | Path to YAML config file |
| `--server` | yes | | Server URL |
| `-n` / `--name` | yes | | Publisher name |
| `-p` / `--passphrase` | yes | | Path to file containing passphrase |
| `--single` | no | | Run only one channel (synchronous, for debugging) |

### Config format

```yaml
channel-name:
  class: mypackage.module.ClassName
  params:
    interval: 5
    groups: [ops, dev]     # restrict to these groups (optional)
    custom_param: value

another-channel:
  class: mypackage.module.AnotherClass
  params:
    interval: 10
```

Each entry maps a channel name to a publisher class and its parameters.
The `groups` and `ttl` keys in `params` are handled by the runner and do not
need to be read by the publisher class itself.

### Writing a publisher

Subclass `IntervalPublisher` and implement `publish()`:

```python
from mntr.publisher.interval_publisher import IntervalPublisher
from mntr.publisher.data.impl import PlaintextData

class MyPublisher(IntervalPublisher):
    def publish(self):
        # self.params contains the 'params' dict from the YAML config
        interval = self.params.get("interval", 5)
        message = self.params.get("message", "default")
        return PlaintextData(data={"text": f"Hello: {message}"})
```

The `publish()` method is called every `interval` seconds (default 5, or
override `get_interval()`). It must return a `MonitorData` instance. If it
raises an exception, an error panel is published automatically.

### Config with YAML anchors

Use YAML anchors to reuse publisher definitions in multi-panel layouts:

```yaml
latency: &LATENCY
  class: myapp.publishers.LatencyPublisher
  params:
    interval: 2

services: &SERVICES
  class: myapp.publishers.ServiceStatusPublisher
  params:
    interval: 4

overview:
  class: examples.example_publishers.DashboardPublisher
  params:
    monitors:
      latency: *LATENCY
      services: *SERVICES
```

---

## Publishing from external programs

Non-Python programs can publish to mntr by constructing the JSON payload and
using the pipe publisher, `curl`, or any HTTP client.

### Using the pipe publisher

The simplest approach for shell scripts and programs that can write to stdout:

```bash
# From a Go program
./my-go-program | python -m mntr.publisher.pipe \
    -t plaintext -c my-channel \
    -n my-pub -p pass.txt --server http://localhost:5100
```

### Using curl (direct API)

For programs that can make HTTP requests, publish directly to the server API.
The payload must be encrypted with the publisher's passphrase using AES-256-GCM.

The protocol requires two steps:

**Step 1: Authenticate**

```bash
# Encrypt a nonce with your passphrase (using the mntr Python library)
python -c "
from mntr.util.encryption import aes_encrypt, aes_decrypt
import json, secrets

passphrase = 'my-passphrase'
nonce = json.dumps({'nonce': secrets.token_hex(16)})
encrypted = aes_encrypt(nonce, passphrase)
print(encrypted)
" > /tmp/encrypted_nonce

# POST to /validate
SESSION_ID=$(curl -s -X POST http://localhost:5100/validate \
    -H 'Content-Type: application/json' \
    -d "{\"message\": \"$(cat /tmp/encrypted_nonce)\"}" \
    | python -c "
import sys, json
from mntr.util.encryption import aes_decrypt
resp = json.load(sys.stdin)
decrypted = json.loads(aes_decrypt(resp['message'], 'my-passphrase'))
print(decrypted['session_id'])
")
```

**Step 2: Publish**

```bash
# Encrypt the payload
PAYLOAD=$(python -c "
from mntr.util.encryption import aes_encrypt
import json

payload = json.dumps({
    'channel': 'my-channel',
    'data': {'display_type': 'plaintext', 'data': {'text': 'Hello!'}, 'alert': None},
    'encoding': 'utf8',
})
print(aes_encrypt(payload, 'my-passphrase'))
")

# POST to /publish
curl -s -X POST http://localhost:5100/publish \
    -H 'Content-Type: application/json' \
    -d "{\"session_id\": \"$SESSION_ID\", \"payload\": \"$PAYLOAD\"}"
```

For non-Python programs, you would need to implement AES-256-GCM encryption
with PBKDF2 key derivation (matching the parameters in `mntr/util/encryption.py`).
The pipe publisher is generally easier.

### JSON payload reference

The inner payload (before encryption) for the `/publish` endpoint:

```json
{
  "channel": "channel-name",
  "data": {
    "display_type": "plaintext | html | table | chartjs | image | multi",
    "data": { ... },
    "alert": null | {"severity": "error|warning|info|success", "title": "...", "message": "..."}
  },
  "encoding": "utf8",
  "groups": ["ops", "dev"],
  "ttl": 60.0
}
```

The `groups` and `ttl` fields are optional. If `groups` is omitted or `null`,
the channel is visible to all users.

---

## Content type summary

| Type | Class | Required data fields | Factory methods |
|---|---|---|---|
| plaintext | `PlaintextData` | `text` (str) | `.build(text=...)` |
| html | `HtmlData` | `html` (str) | `.build(html=...)` |
| table | `TableData` | `table` (list of dicts) | `.build(table=...)`, `.from_dataframe(df)` |
| chartjs | `ChartJSData` | `chartjs_type`, `chartjs_data`, `chartjs_options` | `.line()`, `.bar()`, `.scatter()`, `.radar()`, `.pie()` |
| image | `ImageData` | `image_data_uri` (data URI) | `.from_bytes(b)`, `.from_base64_string(s)` |
| image | `MatplotlibImageData` | `image_data_uri` (data URI) | `.from_figure(fig)` |
| multi | `MultiData` | dict of `MonitorData` instances | constructor only |

All types import from `mntr.publisher.data.impl`:

```python
from mntr.publisher.data.impl import (
    PlaintextData,
    HtmlData,
    TableData,
    ChartJSData,
    ImageData,
    MatplotlibImageData,
    MultiData,
)
from mntr.publisher.data import Alert
```
