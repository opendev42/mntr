#!/usr/bin/env python


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
