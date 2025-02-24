import secrets
from functools import wraps
from pathlib import Path
from typing import Callable, Dict, Generator, List, Optional, cast

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
        if publisher not in self._client_passphrases:
            raise MntrServerException("Unknown publisher")

        passphrase = self._client_passphrases[publisher]
        try:
            decrypted_message = aes_decrypt(message=message, passphrase=passphrase)
        except Exception as e:  # TODO
            raise MntrServerException("Invalid decryption") from e

        channel_data = json.loads(decrypted_message)

        self._state.publish(channel, channel_data, publisher)

    def validate(self, subscriber: str) -> Dict[str, str]:
        if subscriber not in self._client_passphrases:
            raise MntrServerException(f"Unknown user: {subscriber}")

        message = json.dumps(
            {
                "subscriber": subscriber,
                "nonce": secrets.token_hex(16),
            }
        )

        encrypted_message = aes_encrypt(message, self._client_passphrases[subscriber])

        return {"message": encrypted_message}

    def subscribe(
        self, subscriber: str, channels: List[str]
    ) -> Generator[Dict, None, None]:
        """
        Listens for updates on a channels
        """
        if not (passphrase := self._client_passphrases.get(subscriber)):
            raise MntrServerException("Invalid subscriber")

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
            except Exception:
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
        body = cast(Dict, flask.request.json)
        self.publish(channel, body["publisher"], body["message"], body["encoding"])
        return "ok"


class MntrServerException(Exception):
    @property
    def message(self):
        return self.args[0]
