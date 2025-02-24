import base64
from typing import Literal

from mntr.publisher.data import MonitorData


class ImageData(MonitorData):
    @property
    def display_type(self):
        return "image"

    @property
    def expected_keys(self):
        return {"image_data_uri"}

    @classmethod
    def from_bytes(cls, b, image_format: Literal["png", "jpeg"] = "png"):
        data = base64.b64encode(b).decode()
        return cls(data={"image_data_uri": f"data:image/{image_format};base64,{data}"})

    @classmethod
    def from_base64_string(cls, s: str, image_format: Literal["png", "jpeg"] = "png"):
        return cls(data={"image_data_uri": f"data:image/{image_format};base64,{s}"})
