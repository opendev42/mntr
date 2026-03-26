import logging
import secrets
from typing import Optional

import requests  # type: ignore[import-untyped]
import simplejson as json

from mntr.publisher.data import MonitorData
from mntr.types import UrlStr
from mntr.util.encryption import aes_decrypt, aes_encrypt

LOGGER = logging.getLogger(__name__)


class PublisherClient:
    def __init__(
        self,
        server: UrlStr,
        name: str,
        passphrase: str,
        session_id: Optional[str] = None,
    ):
        self._name = name
        self._server = server
        self._passphrase = passphrase
        self._session_id = session_id

    def authenticate(self) -> None:
        nonce = secrets.token_hex(16)
        encrypted_nonce = aes_encrypt(
            json.dumps({"nonce": nonce}), self._passphrase
        )
        response = requests.post(
            url=f"{self._server}/validate",
            json={"message": encrypted_nonce},
        )
        if not response.ok:
            raise Exception(
                f"Authentication failed. status_code: {response.status_code}."
                f" text: {response.text}"
            )
        encrypted_response = response.json()["message"]
        decrypted = json.loads(aes_decrypt(encrypted_response, self._passphrase))
        self._session_id = decrypted["session_id"]
        LOGGER.info("Authenticated as %s", decrypted.get("subscriber", self._name))

    def publish(
        self,
        channel: str,
        channel_data: MonitorData,
        encoding: str = "utf8",
        ttl: Optional[float] = None,
    ):
        if self._session_id is None:
            self.authenticate()

        payload_dict: dict = {
            "channel": channel,
            "data": channel_data.prepare_json(),
            "encoding": encoding,
        }
        if ttl is not None:
            payload_dict["ttl"] = ttl
        payload = json.dumps(payload_dict, ignore_nan=True)
        encrypted_payload = aes_encrypt(payload, self._passphrase)

        response = requests.post(
            url=f"{self._server}/publish",
            json={
                "session_id": self._session_id,
                "payload": encrypted_payload,
            },
        )

        if response.status_code == 400 and "session" in response.text.lower():
            LOGGER.info("Session expired, re-authenticating")
            self.authenticate()
            encrypted_payload = aes_encrypt(payload, self._passphrase)
            response = requests.post(
                url=f"{self._server}/publish",
                json={
                    "session_id": self._session_id,
                    "payload": encrypted_payload,
                },
            )

        if not response.ok:
            raise Exception(
                f"publish failed. status_code: {response.status_code}."
                f" text: {response.text}"
            )
