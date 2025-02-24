import io
import random
from collections import deque
from functools import cached_property

import lipsum
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from mntr.publisher.data import Alert
from mntr.publisher.data.impl import (
    ChartJSData,
    HtmlData,
    ImageData,
    MultiData,
    PlaintextData,
    TableData,
)
from mntr.publisher.interval_publisher import IntervalPublisher


class PlaintextLoremIpsumPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        return PlaintextData(
            data={
                "text": lipsum.generate_sentences(self.params["num_sentences"]),
            }
        )


class HtmlLoremIpsumPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        title = lipsum.generate_words(8)
        body = lipsum.generate_sentences(5)
        content = f"""
        <b>{title}</b>
        <p>{body}</p>
        """
        return HtmlData(
            data={"html": content},
        )


class ErrorPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        raise Exception(f"example error @ {self.__class__.__name__}")


class TablePublisher(IntervalPublisher):

    def get_interval(self):
        return 2

    def publish(self):
        def make_row(row_i):
            return {
                f"column {i}": random.randint(0, 100)
                for i in range(self.params["num_columns"])
            }

        num_rows = random.randint(self.params["min_rows"], self.params["max_rows"] + 1)

        table = [make_row(i) for i in range(num_rows)]

        return TableData(
            data={
                "table": table,
            }
        )


class PandasTablePublisher(IntervalPublisher):

    def get_interval(self):
        return 2.5

    def publish(self):
        df = pd.DataFrame(
            {
                "normal": np.random.normal(0, 1, self.params["num_rows"]),
                "uniform": np.random.uniform(0, 1, self.params["num_rows"]),
            }
        )

        return TableData.from_dataframe(df)


class LineChartPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):

        num_labels = self.params["num_labels"]
        num_datasets = self.params["num_datasets"]

        data = {
            "labels": [f"label_{label_i}" for label_i in range(num_labels)],
            "datasets": [
                {
                    "label": f"dataset_{ds_i}",
                    "data": [random.randint(0, 100) for i in range(num_labels)],
                }
                for ds_i in range(num_datasets)
            ],
        }

        return ChartJSData.line(data)


class ScatterChartPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    @cached_property
    def x(self):
        return deque()

    @cached_property
    def y(self):
        return [deque() for i in range(self.params["num_lines"])]

    def publish(self):

        if len(self.x) > 100:
            self.x = deque()
            self.y = [deque() for i in range(self.params["num_lines"])]

        if not self.x:
            self.x.append(random.random())
            for y_i in range(self.params["num_lines"]):
                self.y[y_i].append(0)
        else:
            self.x.append(self.x[-1] + random.random())
            for y_i in range(self.params["num_lines"]):
                self.y[y_i].append(self.y[y_i][-1] + random.random() * (1 + y_i))

        data = {
            "datasets": [
                {
                    "label": f"line_{line_i}",
                    "data": [
                        {"x": xi, "y": yi} for xi, yi in zip(self.x, self.y[line_i])
                    ],
                    "showLine": True,
                }
                for line_i in range(self.params["num_lines"])
            ]
        }
        return ChartJSData.scatter(data)


class RadarChartPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):

        num_labels = self.params["num_labels"]
        num_datasets = self.params["num_datasets"]

        data = {
            "labels": [f"label_{label_i}" for label_i in range(num_labels)],
            "datasets": [
                {
                    "label": f"dataset_{ds_i}",
                    "data": [random.randint(0, 100) for i in range(num_labels)],
                }
                for ds_i in range(num_datasets)
            ],
        }
        return ChartJSData.radar(data)


class BarChartPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):

        num_labels = self.params["num_labels"]
        num_datasets = self.params["num_datasets"]

        data = {
            "labels": [f"label_{label_i}" for label_i in range(num_labels)],
            "datasets": [
                {
                    "label": f"dataset_{ds_i}",
                    "data": [random.randint(0, 100) for i in range(num_labels)],
                }
                for ds_i in range(num_datasets)
            ],
        }
        return ChartJSData.bar(data)


class PieChartPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):

        num_labels = self.params["num_labels"]
        num_datasets = self.params["num_datasets"]

        data = {
            "labels": [f"label_{label_i}" for label_i in range(num_labels)],
            "datasets": [
                {
                    "label": f"dataset_{ds_i}",
                    "data": [random.randint(0, 100) for i in range(num_labels)],
                }
                for ds_i in range(num_datasets)
            ],
        }

        return ChartJSData.pie(data)


class ImagePublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):

        fig = plt.figure(figsize=(8, 5))
        ax = fig.add_subplot(111)
        ax.hist(np.random.randn(1000), alpha=0.5)
        ax.hist(2 + 0.4 * np.random.randn(1000), alpha=0.5)
        ax.hist(-1 + 0.7 * np.random.randn(1000), alpha=0.5)
        ax.grid(True)
        b = io.BytesIO()
        fig.savefig(b, format="png", bbox_inches="tight", transparent=True)
        plt.close(fig)

        return ImageData.from_bytes(b.getvalue(), image_format="png")


class MultiPagePublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    @cached_property
    def monitors(self):
        return {k: self.from_config(v) for k, v in self.params["monitors"].items()}

    def publish(self):
        return MultiData({k: m.publish() for k, m in self.monitors.items()})


class AlertPublisher(IntervalPublisher):

    def get_interval(self):
        return self.params.get("interval", 5)

    def publish(self):
        return PlaintextData(
            alert=Alert(
                severity=self.params["alert_severity"],
                title=lipsum.generate_words(6),
                message=lipsum.generate_sentences(1),
            ),
            data={
                "text": lipsum.generate_sentences(5),
            },
        )
