import json
import logging
import os
import threading
import time
import uuid
from pathlib import Path
from threading import Condition, Lock
from typing import Any, Dict, Generator, List, NamedTuple, Optional

LOGGER = logging.getLogger(__name__)


class MntrState:
    def __init__(
        self,
        store_path: Optional[Path] = None,
        reaper_interval: float = 5.0,
    ):
        self._conditions: Dict[str, Condition] = {}
        self._condition_any = Condition()
        self._condition_lock = Lock()
        self._channel_data: Dict[str, ChannelData] = {}
        self._channel_data_lock = Lock()
        self._store_path = store_path
        self._reaper_interval = reaper_interval
        self.init_from_store()
        self._reaper_thread = threading.Thread(
            target=self._reap_expired, daemon=True
        )
        self._reaper_thread.start()

    def init_from_store(self) -> None:
        if self._store_path is None:
            return

        if not self._store_path.exists():
            return

        for fn in self._store_path.iterdir():
            if not (fn.suffix == ".json" and fn.stem.startswith("channel-")):
                continue

            try:
                with open(fn, "r", encoding="utf-8") as f:
                    data = json.load(f)
                channel_data = ChannelData(**data)
                if (
                    channel_data.expires_at is not None
                    and time.time() > channel_data.expires_at
                ):
                    LOGGER.info("Skipping expired channel from store: %s", fn.stem)
                    try:
                        os.remove(fn)
                    except OSError:
                        pass
                    continue
                channel = fn.stem.split("-", 1)[1]
                self.update(channel, channel_data, store=False)
            except Exception as e:
                LOGGER.error("Failed to load channel state from %s: %s", fn, e)

    def heartbeat(self, interval: float = 1) -> Generator[Dict, None, None]:
        last_channels: List[str] = []
        last_heartbeat: float = 0

        while True:
            now = time.time()
            channels = [
                ch
                for ch, cd in self._channel_data.items()
                if cd.expires_at is None or now <= cd.expires_at
            ]

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

    def publish(
        self,
        channel: str,
        content: Dict,
        publisher: str,
        ttl: Optional[float] = None,
        groups: Optional[List[str]] = None,
    ) -> None:
        with self._channel_data_lock:
            try:
                last_seqno = self._channel_data[channel].seqno
            except KeyError:
                last_seqno = 0

            seqno = (last_seqno + 1) % 1_000_000_000
            now = time.time()
            expires_at = (now + ttl) if ttl is not None else None

            channel_data = ChannelData(
                channel=channel,
                content=content,
                timestamp=now,
                seqno=seqno,
                publisher=publisher,
                ttl=ttl,
                expires_at=expires_at,
                groups=groups,
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
            dest = self._store_path / f"channel-{channel}.json"
            tmp = self._store_path / f".tmp.{uuid.uuid4()}.json"
            try:
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(channel_data._asdict(), f)
                os.rename(tmp, dest)
            except Exception as e:
                LOGGER.error("Failed to persist channel %s to %s: %s", channel, dest, e)
                try:
                    os.remove(tmp)
                except Exception as cleanup_err:
                    LOGGER.warning("Failed to remove temp file %s: %s", tmp, cleanup_err)

    def remove_channel(self, channel: str) -> None:
        with self._channel_data_lock:
            if channel not in self._channel_data:
                return
            del self._channel_data[channel]

        if self._store_path is not None:
            dest = self._store_path / f"channel-{channel}.json"
            try:
                os.remove(dest)
            except OSError:
                pass

        with self._condition_any:
            self._condition_any.notify_all()

    def _get_channel_data(self, channel):
        data = self._channel_data.get(channel)
        if (
            data is not None
            and data.expires_at is not None
            and time.time() > data.expires_at
        ):
            self.remove_channel(channel)
            return None
        return data

    def _get_condition(self, channel):
        if channel in self._conditions:
            return self._conditions[channel]

        with self._condition_lock:
            if channel not in self._conditions:
                self._conditions[channel] = Condition()
            return self._conditions[channel]

    def _reap_expired(self) -> None:
        while True:
            now = time.time()
            expired = []
            with self._channel_data_lock:
                for channel, cd in self._channel_data.items():
                    if cd.expires_at is not None and now > cd.expires_at:
                        expired.append(channel)
            for channel in expired:
                LOGGER.info("TTL expired for channel: %s", channel)
                self.remove_channel(channel)
            with self._condition_any:
                self._condition_any.wait(timeout=self._reaper_interval)

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
    ttl: Optional[float] = None
    expires_at: Optional[float] = None
    groups: Optional[List[str]] = None
