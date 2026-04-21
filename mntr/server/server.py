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
from typing import (
    Callable,
    Dict,
    Generator,
    List,
    NamedTuple,
    Optional,
    Set,
    Tuple,
    cast,
)

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
from mntr.util.encryption import aes_decrypt, aes_decrypt_url_safe, aes_encrypt


class _Session(NamedTuple):
    user: str
    passphrase: str
    created_at: float


class MntrServer:
    def __init__(
        self,
        client_passphrases: Dict[str, str],
        store_path: Optional[Path] = None,
        debug: bool = False,
        encoding: str = "utf8",
        admin_users: Optional[Set[str]] = None,
        user_groups: Optional[Dict[str, List[str]]] = None,
        rate_limit: int = 10,
        rate_limit_window: float = 60.0,
        session_ttl: float = 86400.0,
    ):
        self._client_passphrases = dict(client_passphrases)
        self._state = MntrState(store_path=store_path)
        self._encoding = encoding
        self._debug = debug
        self._validate_limiter = _RateLimiter(
            max_calls=rate_limit, window=rate_limit_window
        )
        self._admin_limiter = _RateLimiter(
            max_calls=rate_limit, window=rate_limit_window
        )
        self._admin_users = set(admin_users) if admin_users else set()
        self._user_groups: Dict[str, List[str]] = (
            dict(user_groups) if user_groups else {}
        )
        self._store_path = store_path
        self._lock = threading.Lock()
        self._sessions: Dict[str, _Session] = {}
        self._session_lock = threading.Lock()
        self._session_ttl = session_ttl
        self._load_stored_credentials()

    def _create_session(self, user: str) -> str:
        session_id = secrets.token_hex(32)
        passphrase = self._client_passphrases[user]
        with self._session_lock:
            self._sessions[session_id] = _Session(
                user=user, passphrase=passphrase, created_at=time.time()
            )
        return session_id

    def _resolve_session(self, session_id: str) -> _Session:
        with self._session_lock:
            session = self._sessions.get(session_id)
        if session is None:
            raise MntrServerException("Invalid session")
        if time.time() - session.created_at > self._session_ttl:
            with self._session_lock:
                self._sessions.pop(session_id, None)
            raise MntrServerException("Session expired")
        return session

    def _identify_user(self, encrypted_message: str) -> Tuple[str, str]:
        for user, passphrase in self._client_passphrases.items():
            try:
                aes_decrypt(encrypted_message, passphrase)
                return user, passphrase
            except (ValueError, Exception):
                continue
        raise MntrServerException("Invalid credentials")

    def _get_user_groups(self, username: str) -> Set[str]:
        groups = {username}
        for group_name, members in self._user_groups.items():
            if username in members:
                groups.add(group_name)
        return groups

    def _filter_channels(self, username: str, channels: List[str]) -> List[str]:
        if username in self._admin_users:
            return channels
        user_groups = self._get_user_groups(username)
        return [
            ch
            for ch in channels
            if (cd := self._state._get_channel_data(ch)) is not None
            and (not cd.groups or user_groups & set(cd.groups))
        ]

    def _check_subscribe_permissions(
        self, username: str, channels: List[str]
    ) -> None:
        if username in self._admin_users:
            return
        user_groups = self._get_user_groups(username)
        for ch in channels:
            cd = self._state._get_channel_data(ch)
            if cd is not None and cd.groups and not (user_groups & set(cd.groups)):
                raise MntrServerException(
                    f"Permission denied for channel: {ch}"
                )

    def heartbeat(
        self, passphrase: str, username: str, interval: float = 1.0
    ) -> Generator[Dict, None, None]:
        for update in self._state.heartbeat(interval=interval):
            if channels := update.get("channels"):
                channels = self._filter_channels(username, channels)
                encrypted = aes_encrypt(
                    json.dumps(channels), passphrase
                )
                yield {"type": "channels", "data": encrypted}

            if now := update.get("heartbeat"):
                encrypted = aes_encrypt(
                    json.dumps(now), passphrase
                )
                yield {
                    "type": "heartbeat",
                    "data": encrypted,
                }

    def publish(
        self, session: _Session, encrypted_payload: str
    ) -> None:
        try:
            decrypted = aes_decrypt(encrypted_payload, session.passphrase)
        except Exception as e:
            LOGGER.warning("Decryption failed for publisher %s: %s", session.user, e)
            raise MntrServerException("Invalid decryption") from e

        payload = json.loads(decrypted)
        channel = payload.get("channel", "")
        _validate_name(channel, "channel")

        channel_data = payload.get("data", {})
        ttl = payload.get("ttl")
        groups = payload.get("groups")
        if groups is not None:
            if not isinstance(groups, list):
                raise MntrServerException("groups must be a list")
            for g in groups:
                _validate_name(g, "group")
        self._state.publish(
            channel, channel_data, session.user, ttl=ttl, groups=groups
        )

    def validate(self, encrypted_message: str) -> Dict[str, str]:
        user, passphrase = self._identify_user(encrypted_message)
        session_id = self._create_session(user)

        response = json.dumps(
            {
                "session_id": session_id,
                "subscriber": user,
                "nonce": secrets.token_hex(16),
            }
        )

        encrypted_response = aes_encrypt(response, passphrase)
        LOGGER.info("Issued session for user: %s", user)
        return {"message": encrypted_response}

    def subscribe(
        self, passphrase: str, channels: List[str], username: str
    ) -> Generator[Dict, None, None]:
        """
        Listens for updates on channels, encrypting full event payloads.
        """
        for channel in channels:
            _validate_name(channel, "channel")
        self._check_subscribe_permissions(username, channels)

        for channel_data in self._state.subscribe(channels):
            payload = {
                "channel": channel_data.channel,
                "timestamp": channel_data.timestamp,
                "publisher": channel_data.publisher,
                "content": channel_data.content,
            }
            encrypted = aes_encrypt(
                json.dumps(payload, ignore_nan=True),
                passphrase,
                encoding=self._encoding,
            )
            yield {"data": encrypted}

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

        app.route("/publish", methods=["POST"])(self.api_publish)
        app.route("/server/<string:session_id>")(self.api_server)
        app.route("/validate", methods=["POST"])(self.api_validate)
        app.route("/subscribe/<string:session_id>/<path:encrypted_blob>")(
            self.api_subscribe
        )
        app.route("/admin/check", methods=["POST"])(self.api_admin_check)
        app.route("/admin/users", methods=["POST"])(self.api_admin_users)
        app.route("/admin/add_user", methods=["POST"])(self.api_admin_add_user)
        app.route("/admin/remove_user", methods=["POST"])(self.api_admin_remove_user)
        app.route("/admin/set_user_groups", methods=["POST"])(
            self.api_admin_set_user_groups
        )
        app.route("/admin/delete_channel", methods=["POST"])(
            self.api_admin_delete_channel
        )

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
    def api_server(self, session_id: str) -> Generator[str, None, None]:
        session = self._resolve_session(session_id)
        return self.make_event_stream(
            self.heartbeat(session.passphrase, session.user)
        )

    @handle_exception
    def api_subscribe(
        self, session_id: str, encrypted_blob: str
    ) -> Generator[str, None, None]:
        session = self._resolve_session(session_id)
        channels_json = aes_decrypt_url_safe(encrypted_blob, session.passphrase)
        channels = json.loads(channels_json)
        if not isinstance(channels, list):
            raise MntrServerException("Invalid channel list")
        LOGGER.info("Subscriber %s connected to channels: %s", session.user, channels)
        return self.make_event_stream(
            self.subscribe(session.passphrase, channels, session.user)
        )

    @handle_exception
    def api_validate(self):
        ip = flask.request.remote_addr
        if self._validate_limiter.is_limited(ip):
            LOGGER.warning("Rate limit exceeded on /validate from %s", ip)
            raise MntrRateLimitException()
        body = flask.request.json
        if not isinstance(body, dict) or "message" not in body:
            raise MntrServerException("Missing required field: message")
        return json.dumps(self.validate(body["message"]))

    @handle_exception
    def api_publish(self) -> str:
        body = flask.request.json
        if not isinstance(body, dict):
            raise MntrServerException("Request body must be a JSON object")
        for field in ("session_id", "payload"):
            if field not in body:
                raise MntrServerException(f"Missing required field: {field}")
        session = self._resolve_session(body["session_id"])
        self.publish(session, body["payload"])
        return json.dumps({"status": "ok"})


    def _authenticate_admin(self, body: Dict) -> _Session:
        session_id = body.get("session_id", "")
        session = self._resolve_session(session_id)
        if session.user not in self._admin_users:
            raise MntrServerException("Not an admin user")
        return session

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
        stored_groups = data.pop("_groups", {})
        self._admin_users.update(stored_admins)
        for group_name, members in stored_groups.items():
            existing = self._user_groups.setdefault(group_name, [])
            for m in members:
                if m not in existing:
                    existing.append(m)
        self._client_passphrases.update(data)

    def _save_credentials(self) -> None:
        cred_file = self._credentials_file()
        if cred_file is None:
            return
        self._store_path.mkdir(exist_ok=True, parents=True)
        data: dict = {"_admins": sorted(self._admin_users)}
        if self._user_groups:
            data["_groups"] = {
                k: sorted(v) for k, v in self._user_groups.items()
            }
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
        ip = flask.request.remote_addr
        if self._admin_limiter.is_limited(ip):
            raise MntrRateLimitException()
        body = cast(Dict, flask.request.json)
        session_id = body.get("session_id", "")
        session = self._resolve_session(session_id)
        response = json.dumps({"is_admin": session.user in self._admin_users})
        return json.dumps({"data": aes_encrypt(response, session.passphrase)})

    @handle_exception
    def api_admin_users(self):
        body = cast(Dict, flask.request.json)
        session = self._authenticate_admin(body)
        with self._lock:
            users = [
                {
                    "user": u,
                    "is_admin": u in self._admin_users,
                    "groups": sorted(self._get_user_groups(u) - {u}),
                }
                for u in sorted(self._client_passphrases.keys())
            ]
            groups = {
                k: sorted(v) for k, v in self._user_groups.items()
            }
        response = json.dumps({"users": users, "groups": groups})
        return json.dumps({"data": aes_encrypt(response, session.passphrase)})

    @handle_exception
    def api_admin_add_user(self):
        body = cast(Dict, flask.request.json)
        session = self._authenticate_admin(body)
        payload_json = aes_decrypt(body.get("payload", ""), session.passphrase)
        payload = json.loads(payload_json)
        new_user = payload.get("new_user", "").strip()
        new_passphrase = payload.get("new_passphrase", "")
        if not new_user or not new_passphrase:
            raise MntrServerException("Username and passphrase are required")
        if new_user.startswith("_"):
            raise MntrServerException("Usernames starting with '_' are reserved")
        with self._lock:
            if new_user in self._client_passphrases:
                raise MntrServerException("User already exists")
            self._client_passphrases[new_user] = new_passphrase
            self._save_credentials()
        response = json.dumps({"status": "ok"})
        return json.dumps({"data": aes_encrypt(response, session.passphrase)})

    @handle_exception
    def api_admin_remove_user(self):
        body = cast(Dict, flask.request.json)
        session = self._authenticate_admin(body)
        payload_json = aes_decrypt(body.get("payload", ""), session.passphrase)
        payload = json.loads(payload_json)
        target_user = payload.get("target_user", "")
        if target_user == session.user:
            raise MntrServerException("Cannot remove yourself")
        with self._lock:
            if target_user not in self._client_passphrases:
                raise MntrServerException("User not found")
            del self._client_passphrases[target_user]
            self._admin_users.discard(target_user)
            self._save_credentials()
        response = json.dumps({"status": "ok"})
        return json.dumps({"data": aes_encrypt(response, session.passphrase)})


    @handle_exception
    def api_admin_set_user_groups(self):
        body = cast(Dict, flask.request.json)
        session = self._authenticate_admin(body)
        payload_json = aes_decrypt(body.get("payload", ""), session.passphrase)
        payload = json.loads(payload_json)
        target_user = payload.get("target_user", "")
        groups = payload.get("groups", [])
        if not isinstance(groups, list):
            raise MntrServerException("groups must be a list")
        for g in groups:
            _validate_name(g, "group")
        with self._lock:
            if target_user not in self._client_passphrases:
                raise MntrServerException("User not found")
            # Remove user from all existing groups
            for members in self._user_groups.values():
                if target_user in members:
                    members.remove(target_user)
            # Add user to specified groups
            for g in groups:
                self._user_groups.setdefault(g, [])
                if target_user not in self._user_groups[g]:
                    self._user_groups[g].append(target_user)
            # Clean up empty groups
            self._user_groups = {
                k: v for k, v in self._user_groups.items() if v
            }
            self._save_credentials()
        response = json.dumps({"status": "ok"})
        return json.dumps({"data": aes_encrypt(response, session.passphrase)})

    @handle_exception
    def api_admin_delete_channel(self):
        body = cast(Dict, flask.request.json)
        session = self._authenticate_admin(body)
        payload_json = aes_decrypt(body.get("payload", ""), session.passphrase)
        payload = json.loads(payload_json)
        channel = payload.get("channel", "")
        _validate_name(channel, "channel")
        self._state.remove_channel(channel)
        response = json.dumps({"status": "ok"})
        return json.dumps({"data": aes_encrypt(response, session.passphrase)})


class MntrServerException(Exception):
    @property
    def message(self):
        return self.args[0]


class MntrRateLimitException(Exception):
    pass
