#!/bin/bash

WD=$(cd $(dirname $0) && pwd)

TMP_DIR=$(mktemp -d)

python -m mntr.server \
    -a 0.0.0.0 \
    -p 5100 \
    --store_path $TMP_DIR \
    --debug \
    --client_passphrases ${WD}/passphrases/server.yaml

rm -rf $TMP_DIR