"""Layer C — parse the persona-LLM's inline 4-axis self-score."""
from __future__ import annotations


AXES = ("overall_value", "insight_novelty", "emotional_safety", "desire_to_return")


def score_layer_c(layer_c_json: dict | None) -> dict:
    """§6.3. mean(4 axes) / 10."""
    if not layer_c_json:
        return {
            "valid": False,
            "axes": {a: None for a in AXES},
            "narrative": None,
            "layer_c_normalized": 0.0,
        }
    axes = {a: int(layer_c_json.get(a, 0)) for a in AXES}
    mean = sum(axes.values()) / len(axes)
    return {
        "valid": True,
        "axes": axes,
        "narrative": layer_c_json.get("narrative"),
        "layer_c_normalized": mean / 10.0,
    }
