import logging
import re
import secrets
from functools import wraps
from pathlib import Path
from typing import Callable, Dict, Generator, List, Optional, cast

LOGGER = logging.getLogger(__name__)

_NAME_RE = re.compile(r'^[A-Za-z0-9_\-]{1,64}$')


def _validate_name(name: str, label: str) -> None:
    if not _NAME_RE.match(name):
        raise MntrServerException(
            f"Invalid {label}: must be 1-64 alphanumeric/underscore/hyphen characters"
        )

import flask
import simplejson as json
from flask_cors import CORS  # type: ignore[import-untyped]

from mntr.server.state import MntrState
from mntr.util.encryption import aes_decrypt, aes_encrypt


class MntrServer:
    def __init__(
        self,
        client_passphrases: Dict[str, str],
        store_path: Optional[Path] = None,
        debug: bool = False,
        encoding: str = "utf8",
    ):
        self._client_passphrases = client_passphrases
        self._state = MntrState(store_path=store_path)
        self._encoding = encoding
        self._debug = debug

    def heartbeat(self, interval: float = 1.0) -> Generator[Dict, None, None]:
        for update in self._state.heartbeat(interval=interval):
            if channels := update.get("channels"):
                yield {"type": "channels", "data": channels}

            if now := update.get("heartbeat"):
                yield {
                    "type": "heartbeat",
                    "data": now,
                }

    def publish(
        self, channel: str, publisher: str, message: str, encoding: str
    ) -> None:
        _validate_name(channel, "channel")
        _validate_name(publisher, "publisher")

        if publisher not in self._client_passphrases:
            raise MntrServerException("Unknown publisher")

        passphrase = self._client_passphrases[publisher]
        try:
            decrypted_message = aes_decrypt(message=message, passphrase=passphrase)
        except Exception as e:
            LOGGER.warning("Decryption failed for publisher %s on channel %s: %s", publisher, channel, e)
            raise MntrServerException("Invalid decryption") from e

        channel_data = json.loads(decrypted_message)

        self._state.publish(channel, channel_data, publisher)

    def validate(self, subscriber: str) -> Dict[str, str]:
        _validate_name(subscriber, "subscriber")
        if subscriber not in self._client_passphrases:
            LOGGER.warning("Failed login attempt for unknown user: %s", subscriber)
            raise MntrServerException("Invalid credentials")

        message = json.dumps(
            {
                "subscriber": subscriber,
                "nonce": secrets.token_hex(16),
            }
        )

        encrypted_message = aes_encrypt(message, self._client_passphrases[subscriber])
        LOGGER.info("Issued auth challenge for user: %s", subscriber)
        return {"message": encrypted_message}

    def subscribe(
        self, subscriber: str, channels: List[str]
    ) -> Generator[Dict, None, None]:
        """
        Listens for updates on a channels
        """
        _validate_name(subscriber, "subscriber")
        for channel in channels:
            _validate_name(channel, "channel")

        if not (passphrase := self._client_passphrases.get(subscriber)):
            LOGGER.warning("Subscribe rejected for unknown subscriber: %s", subscriber)
            raise MntrServerException("Invalid subscriber")

        LOGGER.info("Subscriber %s connected to channels: %s", subscriber, channels)

        for channel_data in self._state.subscribe(channels):
            encrypted = aes_encrypt(
                json.dumps(channel_data.content, ignore_nan=True),
                passphrase,
                encoding=self._encoding,
            )

            data = {
                "channel": channel_data.channel,
                "data": {
                    "content": encrypted,
                    "timestamp": channel_data.timestamp,
                    "publisher": channel_data.publisher,
                },
            }
            yield data

    @classmethod
    def make_event_stream(cls, generator: Generator):
        def stream():
            try:
                for data in generator:
                    json_data = json.dumps(data, ignore_nan=True)
                    yield f"data: {json_data}\n\n"
            finally:
                # disconnect
                pass

        return flask.Response(stream(), mimetype="text/event-stream")

    def get_app(self, static_folder: Path):
        app = flask.Flask(
            "mntr",
            static_folder=static_folder,
            static_url_path="",
        )

        @app.route("/")
        def index():
            return flask.send_from_directory(app.static_folder, "index.html")

        app.route("/publish/<string:channel>", methods=["POST"])(self.api_publish)
        app.route("/server")(self.api_server)
        app.route("/validate/<string:subscriber>")(self.api_validate)
        app.route("/subscribe/<string:subscriber>/<string:channels>")(
            self.api_subscribe
        )

        if self._debug:
            CORS(app)
            self._client_passphrases["debug"] = "debug"

        return app

    # web api
    @staticmethod
    def handle_exception(method: Callable) -> Callable:
        @wraps(method)
        def wrapped(*args, **kwargs):
            try:
                result = method(*args, **kwargs)
                return result, 200
            except MntrServerException as e:
                return e.message, 400
            except Exception as e:
                LOGGER.exception("Unexpected error in %s: %s", method.__name__, e)
                return "Unknown error occurred", 400

        return wrapped

    @handle_exception
    def api_server(self) -> Generator[str, None, None]:
        return self.make_event_stream(self.heartbeat())

    @handle_exception
    def api_subscribe(
        self, subscriber: str, channels: str
    ) -> Generator[str, None, None]:
        return self.make_event_stream(self.subscribe(subscriber, channels.split(",")))

    @handle_exception
    def api_validate(self, subscriber: str):
        return json.dumps(self.validate(subscriber))

    @handle_exception
    def api_publish(self, channel: str) -> str:
        body = flask.request.json
        if not isinstance(body, dict):
            raise MntrServerException("Request body must be a JSON object")
        for field in ("publisher", "message", "encoding"):
            if field not in body:
                raise MntrServerException(f"Missing required field: {field}")
            if not isinstance(body[field], str):
                raise MntrServerException(f"Field '{field}' must be a string")
        self.publish(channel, body["publisher"], body["message"], body["encoding"])
        return "ok"


class MntrServerException(Exception):
    @property
    def message(self):
        return self.args[0]
