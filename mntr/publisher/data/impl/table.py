import pandas as pd

from mntr.publisher.data import MonitorData


class TableData(MonitorData):
    @property
    def display_type(self):
        return "table"

    @property
    def expected_keys(self):
        return {"table"}

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame):
        return cls.build(table=[row.to_dict() for _, row in df.iterrows()])
