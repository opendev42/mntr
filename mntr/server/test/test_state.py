import time
from threading import Thread

from mntr.server.state import MntrState


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
