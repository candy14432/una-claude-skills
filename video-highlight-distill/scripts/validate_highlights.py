#!/usr/bin/env python3
"""Validate and normalize model-authored highlight ranges against transcript artifacts."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a highlights.json file against selection_input.json and rewrite normalized output."
    )
    parser.add_argument(
        "--selection-input",
        required=True,
        help="Path to selection_input.json from transcribe_video.py.",
    )
    parser.add_argument(
        "--highlights",
        required=True,
        help="Path to the model-authored highlights.json file.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Where to write the validated highlights JSON.",
    )
    return parser.parse_args()


def load_selection_input(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("segments"), list):
        raise ValueError("selection_input.json must be an object with a 'segments' list.")
    return payload


def load_highlights(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        payload = {"segments": payload}
    if not isinstance(payload, dict) or not isinstance(payload.get("segments"), list):
        raise ValueError("highlights JSON must be an object with a 'segments' list or a list of segments.")
    return payload


def compute_transcript_bounds(selection_input: dict[str, Any]) -> tuple[float, float]:
    start_values: list[float] = []
    end_values: list[float] = []

    for segment in selection_input["segments"]:
        if "start" in segment:
            start_values.append(float(segment["start"]))
        if "end" in segment:
            end_values.append(float(segment["end"]))

        words = segment.get("words")
        if not isinstance(words, list):
            continue
        for word in words:
            if "start" in word:
                start_values.append(float(word["start"]))
            if "end" in word:
                end_values.append(float(word["end"]))

    if not start_values or not end_values:
        raise ValueError("selection_input.json does not contain any usable transcript timestamps.")

    return min(start_values), max(end_values)


def normalize_number(value: Any, field_name: str, index: int) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Segment #{index} has a non-numeric '{field_name}'.") from exc
    if not math.isfinite(number):
        raise ValueError(f"Segment #{index} has a non-finite '{field_name}'.")
    return round(number, 3)


def normalize_segments(
    raw_segments: list[dict[str, Any]],
    transcript_start: float,
    transcript_end: float,
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(raw_segments, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Segment #{index} is not an object.")
        if "start" not in item or "end" not in item:
            raise ValueError(f"Segment #{index} must include 'start' and 'end'.")

        start = normalize_number(item["start"], "start", index)
        end = normalize_number(item["end"], "end", index)
        if end <= start:
            raise ValueError(f"Segment #{index} has end <= start.")
        if start < transcript_start:
            raise ValueError(
                f"Segment #{index} starts before the transcript begins ({start} < {round(transcript_start, 3)})."
            )
        if end > transcript_end:
            raise ValueError(
                f"Segment #{index} ends after the transcript ends ({end} > {round(transcript_end, 3)})."
            )

        normalized.append(
            {
                "start": start,
                "end": end,
                "title": str(item.get("title", "")).strip() or None,
                "reason": str(item.get("reason", "")).strip() or None,
            }
        )

    normalized.sort(key=lambda segment: segment["start"])

    previous_end = -1.0
    for index, item in enumerate(normalized, start=1):
        if item["start"] < previous_end:
            raise ValueError(f"Segments overlap after sorting near segment #{index}.")
        previous_end = item["end"]

    return normalized


def build_output(payload: dict[str, Any], segments: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "theme": str(payload.get("theme", "")).strip(),
        "segments": segments,
    }


def main() -> None:
    args = parse_args()
    selection_input_path = Path(args.selection_input).expanduser().resolve()
    highlights_path = Path(args.highlights).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    if not selection_input_path.is_file():
        raise FileNotFoundError(f"selection_input.json not found: {selection_input_path}")
    if not highlights_path.is_file():
        raise FileNotFoundError(f"highlights JSON not found: {highlights_path}")

    selection_input = load_selection_input(selection_input_path)
    highlights = load_highlights(highlights_path)
    transcript_start, transcript_end = compute_transcript_bounds(selection_input)
    normalized_segments = normalize_segments(
        highlights["segments"],
        transcript_start,
        transcript_end,
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(build_output(highlights, normalized_segments), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
