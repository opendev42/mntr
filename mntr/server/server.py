import collections
import logging
import os
import re
import secrets
import tempfile
import threading
import time
from functools import wraps
from pathlib import Path
from typing import Callable, Dict, Generator, List, Optional, Set, cast

LOGGER = logging.getLogger(__name__)

_NAME_RE = re.compile(r'^[A-Za-z0-9_\-]{1,64}$')


class _RateLimiter:
    def __init__(self, max_calls: int, window: float):
        self._max_calls = max_calls
        self._window = window
        self._calls: Dict[str, collections.deque] = {}
        self._lock = threading.Lock()

    def is_limited(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            dq = self._calls.setdefault(key, collections.deque())
            while dq and dq[0] < now - self._window:
                dq.popleft()
            if len(dq) >= self._max_calls:
                return True
            dq.append(now)
            return False


def _validate_name(name: str, label: str) -> None:
    if not _NAME_RE.match(name):
        raise MntrServerException(
            f"Invalid {label}: must be 1-64 alphanumeric/underscore/hyphen characters"
        )

try:
    import flask
    from flask_cors import CORS  # type: ignore[import-untyped]
except ImportError as e:
    raise ImportError(
        "Flask is required for the mntr server. "
        "Install with: pip install mntr[server]"
    ) from e
import simplejson as json
import yaml

from mntr.server.state import MntrState
from mntr.util.encryption import aes_decrypt, aes_encrypt


class MntrServer:
    def __init__(
        self,
        client_passphrases: Dict[str, str],
        store_path: Optional[Path] = None,
        debug: bool = False,
        encoding: str = "utf8",
        admin_users: Optional[Set[str]] = None,
        rate_limit: int = 10,
        rate_limit_window: float = 60.0,
    ):
        self._client_passphrases = dict(client_passphrases)
        self._state = MntrState(store_path=store_path)
        self._encoding = encoding
        self._debug = debug
        self._validate_limiter = _RateLimiter(max_calls=rate_limit, window=rate_limit_window)
        self._admin_users = set(admin_users) if admin_users else set()
        self._store_path = store_path
        self._lock = threading.Lock()
        self._load_stored_credentials()

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
        app.route("/admin/check", methods=["POST"])(self.api_admin_check)
        app.route("/admin/users", methods=["POST"])(self.api_admin_users)
        app.route("/admin/add_user", methods=["POST"])(self.api_admin_add_user)
        app.route("/admin/remove_user", methods=["POST"])(self.api_admin_remove_user)

        if self._debug:
            LOGGER.warning("Debug mode enabled: CORS is open to all origins")
            CORS(app)

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
            except MntrRateLimitException:
                return "Too many requests", 429
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
        ip = flask.request.remote_addr
        if self._validate_limiter.is_limited(ip):
            LOGGER.warning("Rate limit exceeded on /validate from %s", ip)
            raise MntrRateLimitException()
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


    def _authenticate_admin(self, body: Dict) -> str:
        admin_user = body.get("admin_user", "")
        admin_passphrase = body.get("admin_passphrase", "")
        if admin_user not in self._admin_users:
            raise MntrServerException("Not an admin user")
        if self._client_passphrases.get(admin_user) != admin_passphrase:
            raise MntrServerException("Invalid admin credentials")
        return admin_user

    def _credentials_file(self) -> Optional[Path]:
        if self._store_path is None:
            return None
        return self._store_path / "credentials.yaml"

    def _load_stored_credentials(self) -> None:
        cred_file = self._credentials_file()
        if cred_file is None or not cred_file.exists():
            return
        data = yaml.safe_load(cred_file.read_text())
        if not isinstance(data, dict):
            return
        stored_admins = data.pop("_admins", [])
        self._admin_users.update(stored_admins)
        self._client_passphrases.update(data)

    def _save_credentials(self) -> None:
        cred_file = self._credentials_file()
        if cred_file is None:
            return
        self._store_path.mkdir(exist_ok=True, parents=True)
        data = {"_admins": sorted(self._admin_users)}
        data.update(self._client_passphrases)
        fd, tmp_path = tempfile.mkstemp(
            dir=self._store_path, suffix=".yaml"
        )
        try:
            with os.fdopen(fd, "w") as f:
                yaml.dump(data, f, default_flow_style=False)
            os.replace(tmp_path, str(cred_file))
        except Exception:
            os.unlink(tmp_path)
            raise

    @handle_exception
    def api_admin_check(self):
        body = cast(Dict, flask.request.json)
        user = body.get("user", "")
        passphrase = body.get("passphrase", "")
        if user not in self._client_passphrases:
            raise MntrServerException("Unknown user")
        if self._client_passphrases[user] != passphrase:
            raise MntrServerException("Invalid credentials")
        return json.dumps({"is_admin": user in self._admin_users})

    @handle_exception
    def api_admin_users(self):
        body = cast(Dict, flask.request.json)
        self._authenticate_admin(body)
        with self._lock:
            users = [
                {"user": u, "is_admin": u in self._admin_users}
                for u in sorted(self._client_passphrases.keys())
            ]
        return json.dumps({"users": users})

    @handle_exception
    def api_admin_add_user(self):
        body = cast(Dict, flask.request.json)
        self._authenticate_admin(body)
        new_user = body.get("new_user", "").strip()
        new_passphrase = body.get("new_passphrase", "")
        if not new_user or not new_passphrase:
            raise MntrServerException("Username and passphrase are required")
        if new_user.startswith("_"):
            raise MntrServerException("Usernames starting with '_' are reserved")
        with self._lock:
            if new_user in self._client_passphrases:
                raise MntrServerException("User already exists")
            self._client_passphrases[new_user] = new_passphrase
            self._save_credentials()
        return json.dumps({"status": "ok"})

    @handle_exception
    def api_admin_remove_user(self):
        body = cast(Dict, flask.request.json)
        admin_user = self._authenticate_admin(body)
        target_user = body.get("target_user", "")
        if target_user == admin_user:
            raise MntrServerException("Cannot remove yourself")
        with self._lock:
            if target_user not in self._client_passphrases:
                raise MntrServerException("User not found")
            del self._client_passphrases[target_user]
            self._admin_users.discard(target_user)
            self._save_credentials()
        return json.dumps({"status": "ok"})


class MntrServerException(Exception):
    @property
    def message(self):
        return self.args[0]


class MntrRateLimitException(Exception):
    pass
