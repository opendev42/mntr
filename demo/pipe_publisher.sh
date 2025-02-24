#!/bin/bash

WD=$(cd $(dirname $0) && pwd)

export PYTHONPATH=${WD}

# pipe a command into this script

if [ -z "${TYPE}" ]
then
    TYPE=plaintext
fi

python -m mntr.publisher.pipe \
    -c pipe \
    -n client0 \
    -p ${WD}/passphrases/client0.txt \
    -t ${TYPE} \
    --server http://localhost:5100
