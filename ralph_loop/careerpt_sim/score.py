"""Composite session_score = 10 × (0.5·A + 0.3·B + 0.2·C)."""
from __future__ import annotations


def composite_session_score(layer_a_norm: float, layer_b_norm: float, layer_c_norm: float) -> dict:
    score = 10.0 * (0.5 * layer_a_norm + 0.3 * layer_b_norm + 0.2 * layer_c_norm)
    return {
        "layer_a_normalized": layer_a_norm,
        "layer_b_normalized": layer_b_norm,
        "layer_c_normalized": layer_c_norm,
        "session_score": score,
    }
