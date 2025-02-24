import logging
import os
import pickle as pk
import time
import uuid
from pathlib import Path
from threading import Condition, Lock
from typing import Any, Dict, Generator, List, NamedTuple, Optional

LOGGER = logging.getLogger(__name__)


class MntrState:
    def __init__(self, store_path: Optional[Path] = None):
        self._conditions: Dict[str, Condition] = {}
        self._condition_any = Condition()
        self._condition_lock = Lock()
        self._channel_data: Dict[str, ChannelData] = {}
        self._channel_data_lock = Lock()
        self._store_path = store_path
        self.init_from_store()

    def init_from_store(self) -> None:
        if self._store_path is None:
            return

        if not self._store_path.exists():
            return

        for fn in self._store_path.iterdir():
            if not fn.stem.startswith("channel-"):
                continue

            with open(fn, "rb") as f:
                channel_data = pk.load(f)
                channel = fn.stem.split("-", 1)[1]
                self.update(channel, channel_data, store=False)

    def heartbeat(self, interval: float = 1) -> Generator[Dict, None, None]:
        last_channels: List[str] = []
        last_heartbeat: float = 0

        while True:
            channels = list(self._channel_data)
            now = time.time()

            if channels != last_channels:
                last_channels = channels.copy()
                yield {"channels": channels}

            if (now - last_heartbeat) > interval:
                last_heartbeat = now
                yield {
                    "heartbeat": now,
                }

            self._wait(timeout=interval - (now - last_heartbeat))

    def subscribe(self, channels: List[str]) -> Generator["ChannelData", None, None]:
        cache: Dict[str, ChannelData] = {}

        while True:
            for channel in channels:
                channel_data = self._get_channel_data(channel)

                if channel_data is None:
                    channel_data = ChannelData(
                        publisher="__server",
                        channel=channel,
                        timestamp=time.time(),
                        seqno=-1,
                        content={
                            "display_type": "error",
                            "data": {
                                "message": f"Unknown channel: {channel}",
                            },
                        },
                    )

                if channel in cache and channel_data.seqno == cache[channel].seqno:
                    continue
                cache[channel] = channel_data
                yield channel_data

            self._wait()

    def publish(self, channel: str, content: Dict, publisher: str) -> None:
        with self._channel_data_lock:
            try:
                last_seqno = self._channel_data[channel].seqno
            except KeyError:
                last_seqno = 0

            seqno = (last_seqno + 1) % 1_000_000_000

            channel_data = ChannelData(
                channel=channel,
                content=content,
                timestamp=time.time(),
                seqno=seqno,
                publisher=publisher,
            )
            self.update(channel, channel_data)
            LOGGER.info(f"{channel} updated - seqno: {seqno}")

        condition = self._conditions.setdefault(channel, Condition())
        with condition:
            condition.notify_all()

        with self._condition_any:
            self._condition_any.notify_all()

    def update(
        self, channel: str, channel_data: "ChannelData", store: bool = True
    ) -> None:
        self._channel_data[channel] = channel_data

        if store and self._store_path is not None:
            self._store_path.mkdir(exist_ok=True, parents=True)
            dest = self._store_path / f"channel-{channel}.pkl"
            tmp = self._store_path / f".tmp.{uuid.uuid4()}.pkl"
            try:
                with open(tmp, "wb") as f:
                    pk.dump(channel_data, f)
                os.rename(tmp, dest)
            except Exception:
                try:
                    os.remove(tmp)
                except Exception:
                    pass

    def _get_channel_data(self, channel):
        return self._channel_data.get(channel)

    def _get_condition(self, channel):
        if channel in self._conditions:
            return self._conditions[channel]

        with self._condition_lock:
            if channel not in self._conditions:
                self._conditions[channel] = Condition()
            return self._conditions[channel]

    def _wait(self, channel=None, timeout=None):
        if channel is not None:
            condition = self._get_condition(channel)
        else:
            condition = self._condition_any

        with condition:
            self._condition_any.wait(timeout=timeout)


class ChannelData(NamedTuple):
    channel: str
    timestamp: float
    content: Dict[str, Any]
    seqno: int
    publisher: str
