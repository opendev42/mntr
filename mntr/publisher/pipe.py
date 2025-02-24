import argparse
import sys
from pathlib import Path

from mntr.publisher.client import PublisherClient
from mntr.publisher.data.impl import HtmlData, ImageData, PlaintextData


def main():
    args = parse_args()

    with open(args.passphrase, "r") as f:
        passphrase = f.read().strip()

    client = PublisherClient(server=args.server, name=args.name, passphrase=passphrase)

    input_ = sys.stdin.read()

    if args.type == "plaintext":
        data = PlaintextData.build(text=input_)
    elif args.type == "html":
        data = HtmlData.build(html=input_)
    elif args.type == "jpeg_image":
        data = ImageData.from_base64_string(input_, "jpeg")
    elif args.type == "png_image":
        data = ImageData.from_base64_string(input_, "png")
    else:
        raise ValueError(f"Unknown type: {args.type}")

    client.publish(args.channel, data)


def parse_args():
    parser = argparse.ArgumentParser(
        "Runner that publishes from the output of a piped command"
    )
    parser.add_argument(
        "-t",
        "--type",
        default="plaintext",
        choices=["plaintext", "html", "jpeg_image", "png_image"],
        help="Type of display",
    )
    parser.add_argument("-c", "--channel", required=True, help="Channel to publish to")
    parser.add_argument(
        "--server",
        type=str,
        required=True,
        help="Server URL e.g. http://localhost:5100",
    )
    parser.add_argument(
        "-n",
        "--name",
        required=True,
        type=str,
        help="Publisher name",
    )
    parser.add_argument(
        "-p",
        "--passphrase",
        type=Path,
        required=True,
        help="Path to file containing passphrase",
    )
    return parser.parse_args()


if __name__ == "__main__":
    main()
