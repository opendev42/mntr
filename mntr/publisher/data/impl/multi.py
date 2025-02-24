from mntr.publisher.data import MonitorData


class MultiData(MonitorData):
    @property
    def display_type(self):
        return "multi"

    def validate(self):
        for v in self.data.values():
            v.validate()

    def prepare_data(self):
        return {k: v.prepare_json() for k, v in self.data.items()}
