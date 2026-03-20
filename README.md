# `mntr`

`mntr` is a lightweight data visualisation dashboard.
It comprises a server which serves a web dashboard,
and an API for clients to publish data to.

## Prerequisites

- Python 3.10 or later
- No root/system-level installation required

Install into a virtual environment:

```bash
virtualenv venv
venv/bin/pip install -e .            # core + server
venv/bin/pip install -e '.[publisher]'  # adds matplotlib & pandas
```

> All commands in this README are run from the root directory of the repository
> with the virtual environment activated.

## Server

### Running the server

```bash
PYTHONPATH=. venv/bin/python -m mntr.server \
    --address 0.0.0.0 \
    --port 5100 \
    --client_passphrases demo/passphrases/server.yaml
```

| Flag | Default | Description |
|---|---|---|
| `-a` / `--address` | `localhost` | Address to listen on. Use `0.0.0.0` to accept connections from other hosts. |
| `-p` / `--port` | `5100` | Port to listen on. |
| `--client_passphrases` | *(required)* | Path to a YAML file mapping `CLIENT_NAME: PASSPHRASE` for each authorised client. |
| `--store_path` | *(none)* | Directory to persist server state. If omitted, state is not saved across restarts. If a path with existing state is provided, the server resumes from it. |
| `--debug` | `false` | Enables open CORS (required for browser access across origins) and a `debug` user with password `debug`. Do not use in production. |

### Passphrases file format

```yaml
# demo/passphrases/server.yaml
client0: "client0"
client1: "client1"
```

### Admin users

To grant admin privileges to a client, add a `_admins` key to the passphrases file with a list of client names:

```yaml
_admins:
  - client0
client0: "client0"
client1: "client1"
```

Admin users can manage other users (add, remove, change passphrases) through the web dashboard.

## Publishers

Publishers send data to named channels on the server.
There are three ways to publish: a Python API, a pipe interface, and a config-driven interval publisher.

### Python client

The `PublisherClient` class provides the Python API for publishing data.

```python
from mntr.publisher.client import PublisherClient
from mntr.publisher.data.impl import PlaintextData

client = PublisherClient(
    server="http://localhost:5100",
    name="client0",
    passphrase="client0",
)

data = PlaintextData.build(text="hello world")
client.publish("my-channel", data)
```

### Pipe publisher

Reads from stdin and publishes the result to a channel.

```bash
echo "hello world" | PYTHONPATH=. venv/bin/python -m mntr.publisher.pipe \
    --channel my-channel \
    --name client0 \
    --passphrase demo/passphrases/client0.txt \
    --type plaintext \
    --server http://localhost:5100
```

Supported `-t` / `--type` values:

| Type | Description |
|---|---|
| `plaintext` | Plain text |
| `html` | HTML markup |
| `jpeg_image` | Base64-encoded JPEG image |
| `png_image` | Base64-encoded PNG image |

### Interval publisher

Runs one or more publishers on a recurring schedule, each publishing to its own channel.
Publishers are defined in a YAML config file and run as separate processes.

```bash
PYTHONPATH=. venv/bin/python -m mntr.publisher.interval_publisher \
    --config demo/examples/config.yaml \
    --server http://localhost:5100 \
    --name client0 \
    --passphrase demo/passphrases/client0.txt
```

Each entry in the config file maps a channel name to a publisher class and its parameters:

```yaml
my-channel:
  class: mypackage.mymodule.MyPublisher   # must subclass IntervalPublisher
  params:
    interval: 5        # seconds between publishes (optional, default 5)
    my_param: value
```

To implement a publisher, subclass `IntervalPublisher` and implement `publish()`:

```python
from mntr.publisher.interval_publisher import IntervalPublisher
from mntr.publisher.data.impl import PlaintextData

class MyPublisher(IntervalPublisher):
    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        return PlaintextData.build(text="hello from MyPublisher")
```

See `demo/examples/example_publishers.py` for a full set of examples covering
plaintext, HTML, tables, charts, images, alerts, and multi-panel layouts.

## Web client

The web dashboard is served at the server's address and port (e.g. `http://localhost:5100`).
Log in with a client name and its passphrase (as defined in the server's passphrases file).
The dashboard updates in real time via Server-Sent Events.

## Encryption

Because `mntr` is typically used in environments without HTTPS, all published
data is encrypted in transit. The encryption scheme is:

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** PBKDF2-HMAC-SHA256 with 10,000 iterations and a random 16-byte salt
- **Nonce:** 12 bytes, randomly generated per message

The flow for a published message is:

1. The publisher encrypts the payload with its passphrase and sends it to the server.
2. The server decrypts the payload (verifying the GCM authentication tag), then
   re-encrypts it with the subscribing client's passphrase before forwarding.
3. The web client decrypts the message with its passphrase in the browser.

Metadata (channel names, publisher names, timestamps) is not encrypted.
