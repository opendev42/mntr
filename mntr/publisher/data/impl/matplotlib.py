import io

import matplotlib.pyplot as plt

from mntr.publisher.data.impl.image import ImageData


class MatplotlibImageData(ImageData):
    @classmethod
    def from_figure(cls, fig: plt.Figure):
        b = io.BytesIO()
        fig.savefig(b, format="png", bbox_inches="tight", transparent=True)
        plt.close(fig)
        return cls.from_bytes(b.getvalue())
