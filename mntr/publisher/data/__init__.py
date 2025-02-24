import abc
import logging
from typing import Dict, Literal, NamedTuple, Optional

import simplejson as json

LOGGER = logging.getLogger(__name__)


class Alert(NamedTuple):
    severity: Literal["error", "warning", "info", "success"]
    title: Optional[str]
    message: str

    def prepare_json(self) -> Dict:
        return {
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
        }


class MonitorData(NamedTuple):
    data: Dict
    alert: Optional[Alert] = None

    @classmethod
    def build(cls, **kwargs):
        return cls(data=kwargs)

    @abc.abstractproperty
    def display_type(self) -> str: ...

    def assert_type(cls, label, obj, expected):
        if not isinstance(obj, expected):
            raise ValueError(
                f"Invalid type for {label}."
                f" Expected {expected.__name__},"
                f" got {type(obj).__name__}"
            )

    @property
    def expected_keys(self):
        return {}

    def validate(self) -> None:
        self.assert_type(
            f"{type(self).__name__}.data",
            self.data,
            dict,
        )

        try:
            if not self.expected_keys:
                return
        except Exception as e:
            raise ValueError(str(self)) from e

        expected_keys = self.expected_keys

        missing = set(expected_keys) - set(self.data)
        if missing:
            raise ValueError(f"Missing keys from {type(self).__name__}.data: {missing}")

        unexpected = set(self.data) - set(expected_keys)
        if unexpected:
            raise ValueError(
                f"Unexpected keys in {type(self).__name__}.data: {unexpected}"
            )

    def prepare_json(self) -> Dict:
        try:
            json.dumps(self.data, ignore_nan=True)
        except Exception as e:
            err_msg = "Unable to serialise output to json"
            LOGGER.error(err_msg)
            raise e

        return {
            "display_type": self.display_type,
            "alert": self.alert.prepare_json() if self.alert is not None else None,
            "data": self.prepare_data(),
        }

    def prepare_data(self):
        return self.data


class ErrorData(MonitorData):
    def expected_keys(self):
        return {"error_timestamp"}

    @property
    def display_type(self) -> str:
        # XXX TODO
        return "plaintext"
