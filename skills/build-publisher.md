# Build mntr Publisher

## When to use

Use this skill when the user asks to build, create, or implement an mntr publisher - a component that collects or generates data and publishes it to an mntr dashboard server.

## Instructions

You are building a publisher for **mntr**, a real-time encrypted data visualization dashboard. Publishers collect data and send it to the mntr server, which streams it to web dashboards.

### Architecture overview

Publishers run on a loop (interval publisher) or one-shot (pipe/script). The flow is:

1. Publisher creates a `MonitorData` object (plaintext, table, chart, image, html, or multi)
2. `PublisherClient` serializes it to JSON, encrypts with AES-256-GCM using the publisher's passphrase, and POSTs to the server
3. The server decrypts, re-encrypts for each subscriber, and streams via SSE to dashboards

### Step-by-step

1. **Clarify requirements** - Ask the user what data they want to visualize and how (text, table, chart, image, HTML). Determine if this is an interval publisher (recurring) or a one-shot script.

2. **Choose the right data type** - Pick from the available `MonitorData` subclasses:

   | Type | Import | Use for | Construction |
   |------|--------|---------|-------------|
   | `PlaintextData` | `from mntr.publisher.data.impl import PlaintextData` | Simple text | `PlaintextData.build(text="...")` |
   | `HtmlData` | `from mntr.publisher.data.impl import HtmlData` | Rich HTML | `HtmlData.build(html="<b>...</b>")` |
   | `TableData` | `from mntr.publisher.data.impl import TableData` | Tabular data | `TableData.build(table=[{"col": val}, ...])` or `TableData.from_dataframe(df)` |
   | `ChartJSData` | `from mntr.publisher.data.impl import ChartJSData` | Charts (line, bar, pie, scatter, radar) | `ChartJSData.line(data, options)`, `.bar(...)`, `.pie(...)`, `.scatter(...)`, `.radar(...)` |
   | `ImageData` | `from mntr.publisher.data.impl import ImageData` | PNG/JPEG images | `ImageData.from_bytes(b, image_format="png")` |
   | `MatplotlibImageData` | `from mntr.publisher.data.impl.matplotlib import MatplotlibImageData` | Matplotlib figures | `MatplotlibImageData.from_figure(fig)` |
   | `MultiData` | `from mntr.publisher.data.impl import MultiData` | Multi-page panels | `MultiData({"page1": PlaintextData(...), "page2": TableData(...)})` |

3. **Implement the publisher** - For interval publishers, subclass `IntervalPublisher`:

   ```python
   from mntr.publisher.interval_publisher import IntervalPublisher
   from mntr.publisher.data.impl import PlaintextData

   class MyPublisher(IntervalPublisher):
       def get_interval(self) -> int:
           return self.params.get("interval", 5)  # seconds between publishes

       def publish(self) -> PlaintextData:
           # Collect/generate data here
           # self.params contains config params from YAML
           value = self.params["some_param"]
           return PlaintextData.build(text=f"Value: {value}")
   ```

   Key rules for `IntervalPublisher`:
   - Override `publish()` (required) - return a `MonitorData` instance, never `None`
   - Override `get_interval()` (optional) - return seconds between publishes, default 5
   - Access config via `self.params` dict
   - Use `@functools.cached_property` for expensive one-time setup
   - Exceptions in `publish()` are caught by the runner and displayed as error panels

   For one-shot scripts, use `PublisherClient` directly:

   ```python
   from mntr.publisher.client import PublisherClient
   from mntr.publisher.data.impl import PlaintextData

   client = PublisherClient(
       server="http://localhost:5100",
       name="my_publisher",
       passphrase="the_passphrase"
   )
   data = PlaintextData.build(text="Hello")
   client.publish("my_channel", data)
   ```

4. **Write the config** - Create a YAML config for interval publishers:

   ```yaml
   channel_name:
     class: my_module.MyPublisher
     params:
       some_param: value
       interval: 5
   ```

   - Keys are channel names (must match `^[A-Za-z0-9_\-]{1,64}$`)
   - `class` is the fully-qualified Python class path
   - `params` is passed as a dict to the constructor
   - Use YAML anchors (`&NAME` / `*NAME`) for reuse across channels

5. **Set channel groups** (optional) - Restrict who can see the channel:

   ```python
   # Only users in the "ops" group can see this channel
   client.publish("ops-logs", data, groups=["ops"])

   # Only a specific user (implicit personal group)
   client.publish("private", data, groups=["bob"])

   # Visible to all (default when groups omitted)
   client.publish("public", data)
   ```

   Groups set by publishers act as fallback read permissions. Admins can override these via the dashboard with explicit read/write group permissions. If an admin has set `write_groups` on a channel, only users in those groups can publish to it.

   For interval publishers, set groups in the YAML config:

   ```yaml
   my-channel:
     class: my_module.MyPublisher
     params:
       interval: 5
       groups: [ops, dev]   # restrict visibility to these groups
   ```

6. **Add alerts** (optional) - Attach alerts to any data type:

   ```python
   from mntr.publisher.data import Alert

   data = PlaintextData(
       data={"text": "Current status"},
       alert=Alert(
           severity="warning",  # "error" | "warning" | "info" | "success"
           title="High latency detected",
           message="p99 > 500ms for the last 5 minutes"
       )
   )
   ```

7. **Multi-page panels** - Combine multiple data types in one panel:

   ```python
   from mntr.publisher.data.impl import MultiData, PlaintextData, ChartJSData

   data = MultiData({
       "summary": PlaintextData.build(text="All good"),
       "chart": ChartJSData.line({"labels": [...], "datasets": [...]}),
   })
   ```

### ChartJS data format

Charts follow Chart.js conventions:

```python
# Line / Bar / Radar / Pie
ChartJSData.line({
    "labels": ["Jan", "Feb", "Mar"],
    "datasets": [
        {"label": "Series A", "data": [10, 20, 30]},
        {"label": "Series B", "data": [5, 15, 25]},
    ]
})

# Scatter (x/y points)
ChartJSData.scatter({
    "datasets": [
        {
            "label": "Points",
            "data": [{"x": 1, "y": 2}, {"x": 3, "y": 4}],
            "showLine": True,  # connect points with lines
        }
    ]
})

# All chart types accept an optional `options` dict (Chart.js options object)
ChartJSData.line(data, options={"scales": {"y": {"beginAtZero": True}}})
```

### Running publishers

```bash
# Activate the project venv
source venv.mntr/bin/activate

# Multi-channel from config (each channel in its own process)
PYTHONPATH=. python -m mntr.publisher.interval_publisher \
    -c config.yaml \
    --server http://localhost:5100 \
    --name publisher_name \
    --passphrase path/to/passphrase.txt

# Single channel (synchronous, useful for debugging)
PYTHONPATH=. python -m mntr.publisher.interval_publisher \
    -c config.yaml \
    --server http://localhost:5100 \
    --name publisher_name \
    --passphrase path/to/passphrase.txt \
    --single channel_name
```

If the publisher module is outside the project root, add its parent to `PYTHONPATH`.

### File placement

- Place publisher modules alongside the config or in a dedicated directory
- Reference existing examples at `demo/examples/example_publishers.py` and `demo/examples/config.yaml`
- The publisher's module path in the config must be importable from the working directory

### Common patterns from existing publishers

- **Stateful publishers**: Use `@cached_property` for state that accumulates across publishes (see `ScatterChartPublisher` which maintains x/y deques)
- **Pandas integration**: Use `TableData.from_dataframe(df)` to publish DataFrames directly
- **Matplotlib figures**: Create figure, render to bytes, use `ImageData.from_bytes()` or `MatplotlibImageData.from_figure(fig)` - always call `plt.close(fig)` after
- **Nested multi-page**: `MultiPagePublisher` uses `IntervalPublisher.from_config()` to compose sub-publishers from config

### Validation

- Channel and publisher names: `^[A-Za-z0-9_\-]{1,64}$`
- `MonitorData.validate()` checks required keys exist and no unexpected keys are present
- `publish()` must never return `None`
- Data must be JSON-serializable (use `simplejson` with `ignore_nan=True` internally)
