# `mntr`

`mntr` is a lightweight data visualisation dashboard.
It comprises a server which serves a web dashboard,
and an API for clients to publish data to.

## Requirements

- No installation is required (can be run in environments without root privileges).
- Python (developed on 3.12)
- Required packages are listed in `requirements.txt`


## Note
All examples in this README are run from the root directory of this repository.

## Server

### Running the server

To start the server, use the main program of the `mntr.server` module.

```bash
python -m mntr.server -p 5100 --client_passphrases demo/passphrases/server.yaml
```

The client passphrases is a yaml file containing a dictionary with
`CLIENT_NAME: CLIENT_PASSPHRASE` key/value pairs for authorised clients.

### Server state

The `--store_path` argument accepts a path to a directory where
the server will store its state.
- If this argument is not provided, the server will not persist any state.
- If existing data is available at the given path, the server 
will be started with the state found.

## Publishers

Publishers can publish data to the server.

### Python Client

The `mntr.publisher.client.PublisherClient` class provides the interface in python
for publishing data to the server.

Here is a simple example of how to construct and publish plaintext data from a python program.
```python
from mntr.publisher.client import PublisherClient
from mntr.publisher.data.impl import PlaintextData

SERVER = "http://localhost:5100"
NAME = "client0"
PASSPHRASE = "client0"

# initialise client
client = PublisherClient(server=SERVER, name=NAME, passphrase=PASSPHRASE)

# construct data
data = PlaintextData.build(text="hello world")

# publish to the "test" channel
client.publish("test", data)
```

### Pipe

The `mntr.publisher.pipe` program provides an interface for redirecting
command line output to be published.

```bash
echo "hello world" | python -m mntr.publisher.pipe -c channel0 -n client0 -p demo/passphrases/client0.txt -t plaintext --server http://localhost:5100
```

### Supported types
- `plaintext` - plain text 
- `html` - html
- `jpeg` - base64 URI encoded
- `png` - base64 URI encoded


## Web client

The web client is available at the port that the server is run on.
Users are required to log in with their client name and passphrase.


## Encryption

As `mntr` is expected to be used in environments where `https` is unlikely available,
all data transmitted (but not metadata) is encrypted with simple AES (ECB) encryption.
The client passphrases are used to encrypt channel data sent by the server,
and publisher clients encrypt the data they publish to the server with the same 
passphrases.