#!/bin/bash

WD=$(cd $(dirname $0) && pwd)

export PYTHONPATH=${WD}

python -m mntr.publisher.interval_publisher \
    -c ${WD}/examples/config.yaml \
    --server http://localhost:5100 \
    --name client0 \
    --passphrase ${WD}/passphrases/client0.txt