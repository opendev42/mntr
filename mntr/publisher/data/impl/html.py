from mntr.publisher.data import MonitorData


class HtmlData(MonitorData):
    @property
    def display_type(self):
        return "html"

    @property
    def expected_keys(self):
        return {"html"}

    def validate(self):
        MonitorData.validate(self)
        self.assert_type(
            "html",
            self.data["html"],
            str,
        )
