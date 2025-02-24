import abc
import argparse
import datetime
import importlib
import logging
import signal
import sys
import time
from abc import ABCMeta
from ctypes import c_int
from multiprocessing import Process, Value

import yaml

from mntr.publisher.client import PublisherClient
from mntr.publisher.data import Alert, ErrorData, MonitorData
from mntr.types import UrlStr

LOGGER = logging.getLogger(__name__)


class IntervalPublisher(metaclass=abc.ABCMeta):
    def __init__(self, params):
        self.params = params

    def get_interval(self) -> int:
        return self.params.get("interval", 5)

    @abc.abstractmethod
    def publish(self) -> MonitorData: ...

    def generate(self) -> MonitorData:
        data = self.publish()

        if data is None:
            raise ValueError(f"Publisher {type(self).__name__} returned None")

        data.validate()
        return data

    @classmethod
    def from_config(cls, monitor_config):
        module_name, class_name = monitor_config["class"].rsplit(".", 1)
        module = importlib.import_module(module_name)
        monitor_class = getattr(module, class_name)
        monitor = monitor_class(params=monitor_config.get("params", {}))
        return monitor


class AbstractRunner(metaclass=ABCMeta):
    def __init__(
        self,
        channel: str,
        publisher: IntervalPublisher,
        server: UrlStr,
        name: str,
        passphrase: str,
    ):
        self.__server = server
        self.__channel = channel
        self.__publisher = publisher
        self.__logger = logging.getLogger(f"AbstractRunner.{self.__channel}")
        self.__stopped = Value(c_int)
        self.__client = PublisherClient(server, name, passphrase)

    def run(self):
        while not self.__stopped.value:
            self.__logger.info(f"Generating {self.__channel}")
            try:
                channel_data = self.__publisher.generate()
            except Exception as e:
                channel_data = ErrorData(
                    data={"text": repr(e)},
                    alert=Alert(
                        severity="error",
                        title=f"Error generating {self.__channel}",
                        message=datetime.datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S.%f"
                        ),
                    ),
                )
            try:
                self.__client.publish(
                    channel=self.__channel,
                    channel_data=channel_data,
                )
            except Exception as e:
                self.__logger.error(
                    f"Updating failed {self.__channel} @ {self.__server}"
                )
                self.__logger.error(str(e))
            else:
                self.__logger.info("Updating OK")
            time.sleep(self.__publisher.get_interval())

    def stop(self):
        self.__stopped.value = 1
        self.join()

    @abc.abstractmethod
    def join(self): ...


class ProcessRunner(AbstractRunner, Process):
    def __init__(self, channel, publisher, server, name, passphrase, **kwargs):
        AbstractRunner.__init__(self, channel, publisher, server, name, passphrase)
        Process.__init__(self, **kwargs)

    def join(self):
        Process.join(self)


class LocalRunner(AbstractRunner):
    def start(self):
        self.run()

    def join(self):
        pass


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )

    args = parse_args()

    config = yaml.load(open(args.config), Loader=yaml.Loader)

    publishers = {}

    for channel, monitor_config in config.items():
        if args.single and channel != args.single:
            continue

        monitor = IntervalPublisher.from_config(monitor_config)

        if args.single:
            publisher = LocalRunner(
                channel, monitor, args.server, args.name, args.passphrase
            )
        else:
            publisher = ProcessRunner(
                channel, monitor, args.server, args.name, args.passphrase
            )

        publishers[channel] = publisher
        publisher.start()

    def signal_handler(sig, frame):
        for publisher in publishers.values():
            publisher.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    for publisher in publishers.values():
        publisher.join()


def parse_args():
    parser = argparse.ArgumentParser("Runner that runs publishers from a config file")
    parser.add_argument("-c", "--config", required=True, help="Config yaml file")
    parser.add_argument(
        "--server",
        type=str,
        required=True,
        help="Server URL e.g. http://localhost:5100",
    )
    parser.add_argument(
        "--single",
        type=str,
        default=None,
        help="If provided, runs a single monitor in the config. "
        "Otherwise, runs all in multiprocessing mode.",
    )
    parser.add_argument(
        "-n",
        "--name",
        type=str,
        required=True,
        help="Name of the publisher",
    )

    parser.add_argument(
        "-p",
        "--passphrase",
        type=lambda f: open(f).read().strip(),
        required=True,
        help="File containing passphrase",
    )

    return parser.parse_args()


if __name__ == "__main__":
    main()
