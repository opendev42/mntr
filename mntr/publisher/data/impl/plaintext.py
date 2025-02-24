from mntr.publisher.data import MonitorData


class PlaintextData(MonitorData):
    @property
    def display_type(self):
        return "plaintext"

    @property
    def expected_keys(self):
        return {"text"}

    def validate(self):
        MonitorData.validate(self)
        self.assert_type(
            "text",
            self.data["text"],
            str,
        )
