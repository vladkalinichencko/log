from .errors import RendererUnavailableError

MILLIMETRE = 1 / 25.4

STYLES = {
    "matplotlib": {},
    "nature": {
        "figure.figsize": (89 * MILLIMETRE, 60 * MILLIMETRE),
        "savefig.dpi": 300,
        "font.family": "sans-serif",
        "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
        "font.size": 7,
        "axes.labelsize": 7,
        "xtick.labelsize": 6,
        "ytick.labelsize": 6,
        "axes.linewidth": 0.5,
        "lines.linewidth": 1.0,
        "xtick.major.width": 0.5,
        "ytick.major.width": 0.5,
        "axes.spines.top": False,
        "axes.spines.right": False,
    },
}


def draw(lines: list[tuple[str, list[float], list[float]]], x_label: str, path: str, style: str) -> None:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as e:
        raise RendererUnavailableError(f"renderer {style!r} unavailable: {e}") from e
    with plt.rc_context(STYLES[style]):
        figure, axes = plt.subplots()
        for name, xs, ys in lines:
            axes.plot(xs, ys, label=name)
        axes.set_xlabel(x_label)
        if len(lines) > 1:
            axes.legend()
        else:
            axes.set_ylabel(lines[0][0])
        figure.savefig(path, bbox_inches="tight")
        plt.close(figure)
