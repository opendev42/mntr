import requests  # type: ignore[import-untyped]
import simplejson as json

# from Crypto.PublicKey import RSA
from mntr.publisher.data import MonitorData
from mntr.types import UrlStr
from mntr.util.encryption import aes_encrypt


class PublisherClient:
    def __init__(self, server: UrlStr, name: str, passphrase: str):
        self._name = name
        self._server = server
        self._passphrase = passphrase

    def publish(
        self,
        channel: str,
        channel_data: MonitorData,
        encoding: str = "utf8",  # TODO: server encoding?
    ):
        channel_data_json = json.dumps(channel_data.prepare_json(), ignore_nan=True)
        message = aes_encrypt(channel_data_json, self._passphrase)

        response = requests.post(
            url=f"{self._server}/publish/{channel}",
            json={
                "publisher": self._name,
                "message": message,
                "encoding": encoding,
            },
        )

        if not response.ok:
            raise Exception(
                f"publish failed. status_code: {response.status_code}."
                f" text: {response.text}"
            )
