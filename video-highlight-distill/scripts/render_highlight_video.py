#!/usr/bin/env python3
"""Cut selected highlight ranges from a source video and concatenate them into one output file."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

DEFAULT_MERGE_GAP_SECONDS = 1.5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a highlights edit from source video and JSON segment timestamps."
    )
    parser.add_argument("--input", required=True, help="Source video path.")
    parser.add_argument(
        "--segments",
        required=True,
        help="JSON file containing selected highlight ranges.",
    )
    parser.add_argument("--output", required=True, help="Output video path.")
    parser.add_argument(
        "--merge-gap-seconds",
        type=float,
        default=DEFAULT_MERGE_GAP_SECONDS,
        help="Merge adjacent highlight blocks when the gap is at or below this threshold.",
    )
    return parser.parse_args()


def load_segments(path: Path) -> list[dict[str, Any]]:
    raw_payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw_payload, dict):
        raw_segments = raw_payload.get("segments")
    else:
        raw_segments = raw_payload

    if not isinstance(raw_segments, list) or not raw_segments:
        raise ValueError("Segments JSON must contain a non-empty 'segments' list or be a list.")

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(raw_segments, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Segment #{index} is not an object.")
        if "start" not in item or "end" not in item:
            raise ValueError(f"Segment #{index} must include 'start' and 'end'.")
        start = float(item["start"])
        end = float(item["end"])
        if end <= start:
            raise ValueError(f"Segment #{index} has end <= start.")
        normalized.append(
            {
                "start": start,
                "end": end,
                "title": item.get("title"),
                "reason": item.get("reason"),
            }
        )

    normalized.sort(key=lambda segment: segment["start"])
    return normalized


def merge_segments(
    segments: list[dict[str, Any]],
    merge_gap_seconds: float,
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for segment in segments:
        if not merged:
            merged.append(dict(segment))
            continue

        previous = merged[-1]
        if segment["start"] <= previous["end"] + merge_gap_seconds:
            previous["end"] = max(previous["end"], segment["end"])
            continue

        merged.append(dict(segment))
    return merged


def cut_clip(source_video: Path, segment: dict[str, Any], output_path: Path) -> None:
    duration = segment["end"] - segment["start"]
    command = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{segment['start']:.3f}",
        "-i",
        str(source_video),
        "-t",
        f"{duration:.3f}",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(output_path),
    ]
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def escape_concat_path(path: Path) -> str:
    return path.as_posix().replace("'", r"'\''")


def concat_clips(clip_paths: list[Path], output_path: Path, temp_dir: Path) -> None:
    concat_file = temp_dir / "concat.txt"
    concat_file.write_text(
        "".join(f"file '{escape_concat_path(clip_path)}'\n" for clip_path in clip_paths),
        encoding="utf-8",
    )

    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c",
        "copy",
        str(output_path),
    ]
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def main() -> None:
    args = parse_args()
    source_video = Path(args.input).expanduser().resolve()
    segments_path = Path(args.segments).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    if not source_video.is_file():
        raise FileNotFoundError(f"Video not found: {source_video}")
    if not segments_path.is_file():
        raise FileNotFoundError(f"Segments JSON not found: {segments_path}")

    selected_segments = load_segments(segments_path)
    merged_segments = merge_segments(selected_segments, args.merge_gap_seconds)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="video-highlights-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        clip_paths: list[Path] = []
        for index, segment in enumerate(merged_segments, start=1):
            clip_path = temp_dir / f"clip_{index:03d}.mp4"
            cut_clip(source_video, segment, clip_path)
            clip_paths.append(clip_path)

        concat_clips(clip_paths, output_path, temp_dir)

    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
