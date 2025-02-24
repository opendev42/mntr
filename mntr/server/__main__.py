import argparse
import logging
from pathlib import Path

import yaml

from mntr.server.server import MntrServer


def main():
    args = parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )

    client_passphrases = yaml.safe_load(args.client_passphrases.read_text())

    server = MntrServer(
        debug=args.debug,
        store_path=args.store_path,
        client_passphrases=client_passphrases,
    )
    app = server.get_app(static_folder=Path(__file__).parent.parent / "web")
    app.run(args.address, port=args.port)


def parse_args():
    parser = argparse.ArgumentParser("Runs a mntr server")
    parser.add_argument(
        "-a",
        "--address",
        default="localhost",
        help="Address the server to listens on.",
    )
    parser.add_argument(
        "-p", "--port", default=5100, help="Port the server listens on."
    )
    parser.add_argument(
        "--client_passphrases",
        required=True,
        type=Path,
        help="Authorised client passphrases "
        "(dictionary in a yaml file CLIENT:PASSPHRASE)",
    )
    parser.add_argument(
        "--store_path",
        type=Path,
        default=None,
        help="Path to store server state. "
        "Optional - no state is not persisted if not provided.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        default=False,
        help="Runs the server in debugging mode. "
        "(Allows CORS, and provides a `debug` user. Password = `debug`)",
    )

    return parser.parse_args()


main()
