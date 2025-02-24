from mntr.publisher.data import MonitorData


class ChartJSData(MonitorData):
    @property
    def display_type(self):
        return "chartjs"

    @property
    def expected_keys(self):
        return {"chartjs_type", "chartjs_data", "chartjs_options"}

    def validate(self):
        MonitorData.validate(self)
        chartjs_type = self.data["chartjs_type"]

        VALID_CHARTJS_TYPES = (
            "line",
            "scatter",
            "radar",
            "bar",
            "pie",
        )

        if chartjs_type not in VALID_CHARTJS_TYPES:
            raise ValueError(f"Invalid chartjs_type: {chartjs_type}")

    @classmethod
    def _make(cls, chartjs_type, chartjs_data, chartjs_options):
        return cls(
            data={
                "chartjs_type": chartjs_type,
                "chartjs_data": chartjs_data,
                "chartjs_options": chartjs_options,
            }
        )

    @classmethod
    def line(cls, data, options=None):
        return cls._make("line", data, options or {})

    @classmethod
    def scatter(cls, data, options=None):
        return cls._make("scatter", data, options or {})

    @classmethod
    def radar(cls, data, options=None):
        return cls._make("radar", data, options or {})

    @classmethod
    def bar(cls, data, options=None):
        return cls._make("bar", data, options or {})

    @classmethod
    def pie(cls, data, options=None):
        return cls._make("pie", data, options or {})
