import json
import time
from threading import Thread

from mntr.server.state import ChannelData, MntrState


def test_state():
    state = MntrState()

    received = {}
    sent = {}

    def _subscriber():
        stream = state.subscribe(["channel0", "channel1"])
        for message in stream:
            try:
                if message.content["message"] is None:
                    break
            except KeyError:
                continue
            received.setdefault(message.channel, []).append(message.content)

    def _publisher():
        for i in range(3):
            state.publish("channel0", {"message": f"message{i}"}, "publisher1")
            sent.setdefault("channel0", []).append({"message": f"message{i}"})

            state.publish("channel1", {"message": f"message{i}"}, "publisher1")
            sent.setdefault("channel1", []).append({"message": f"message{i}"})
            time.sleep(0.1)

        state.publish("channel0", {"message": None}, "publisher1")

    t_sub = Thread(target=_subscriber)
    t_sub.start()
    time.sleep(0.2)
    _publisher()
    t_sub.join()
    assert sent == received


def test_remove_channel():
    state = MntrState()
    state.publish("ch1", {"text": "hello"}, "pub1")
    assert state._get_channel_data("ch1") is not None
    state.remove_channel("ch1")
    assert state._get_channel_data("ch1") is None


def test_remove_channel_deletes_file(tmp_path):
    store = tmp_path / "store"
    store.mkdir()
    state = MntrState(store_path=store)
    state.publish("ch1", {"text": "hello"}, "pub1")
    assert (store / "channel-ch1.json").exists()
    state.remove_channel("ch1")
    assert not (store / "channel-ch1.json").exists()


def test_remove_nonexistent_channel():
    state = MntrState()
    state.remove_channel("no-such-channel")  # should not raise


def test_publish_with_ttl():
    state = MntrState()
    state.publish("ch1", {"text": "hello"}, "pub1", ttl=60.0)
    cd = state._get_channel_data("ch1")
    assert cd is not None
    assert cd.ttl == 60.0
    assert cd.expires_at is not None
    assert cd.expires_at > time.time()


def test_publish_without_ttl_persists():
    state = MntrState()
    state.publish("ch1", {"text": "hello"}, "pub1")
    cd = state._get_channel_data("ch1")
    assert cd is not None
    assert cd.ttl is None
    assert cd.expires_at is None


def test_ttl_expiry():
    state = MntrState(reaper_interval=0.1)
    state.publish("ch1", {"text": "hello"}, "pub1", ttl=0.2)
    assert state._get_channel_data("ch1") is not None
    time.sleep(0.5)
    assert state._get_channel_data("ch1") is None


def test_init_from_store_skips_expired(tmp_path):
    store = tmp_path / "store"
    store.mkdir()
    expired_data = ChannelData(
        channel="old",
        timestamp=time.time() - 100,
        content={"text": "stale"},
        seqno=1,
        publisher="pub1",
        ttl=10.0,
        expires_at=time.time() - 50,
    )
    with open(store / "channel-old.json", "w") as f:
        json.dump(expired_data._asdict(), f)
    state = MntrState(store_path=store)
    assert state._get_channel_data("old") is None
    assert not (store / "channel-old.json").exists()
