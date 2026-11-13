#!/usr/bin/env python3
"""Transcribe a video into timestamped text artifacts for highlight selection."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import mlx_whisper

DEFAULT_MODEL_DIR = "models/whisper-large-v3-turbo-q4"
DEFAULT_LONG_VIDEO_SECONDS = 30 * 60
DEFAULT_LARGE_VIDEO_MB = 250


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract audio from a video, transcribe it with MLX Whisper, and save transcript artifacts."
    )
    parser.add_argument("--input", required=True, help="Source video path.")
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory where transcript artifacts should be written.",
    )
    parser.add_argument(
        "--model-path",
        default=DEFAULT_MODEL_DIR,
        help="Local path to the downloaded MLX Whisper model.",
    )
    parser.add_argument(
        "--long-video-seconds",
        type=int,
        default=DEFAULT_LONG_VIDEO_SECONDS,
        help="Treat videos at or above this duration as long and use low bitrate MP3 extraction.",
    )
    parser.add_argument(
        "--large-video-mb",
        type=int,
        default=DEFAULT_LARGE_VIDEO_MB,
        help="Treat videos at or above this size as large and use low bitrate MP3 extraction.",
    )
    return parser.parse_args()


def run_command(command: list[str]) -> str:
    completed = subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return completed.stdout.strip()


def probe_duration_seconds(video_path: Path) -> float:
    output = run_command(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ]
    )
    return float(output)


def format_timestamp(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def build_readable_transcript(segments: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for segment in segments:
        start = format_timestamp(float(segment["start"]))
        end = format_timestamp(float(segment["end"]))
        text = str(segment.get("text", "")).strip()
        lines.append(f"[{start} - {end}] {text}")
    return "\n".join(lines) + "\n"


def build_selection_input(
    source_video: Path,
    transcript_result: dict[str, Any],
) -> dict[str, Any]:
    compact_segments: list[dict[str, Any]] = []
    for segment in transcript_result.get("segments", []):
        compact_segment = {
            "start": round(float(segment["start"]), 3),
            "end": round(float(segment["end"]), 3),
            "text": str(segment.get("text", "")).strip(),
        }
        words = segment.get("words")
        if isinstance(words, list) and words:
            compact_segment["words"] = [
                {
                    "start": round(float(word["start"]), 3),
                    "end": round(float(word["end"]), 3),
                    "word": str(word.get("word", "")).strip(),
                }
                for word in words
                if "start" in word and "end" in word
            ]
        compact_segments.append(compact_segment)

    return {
        "source_video": str(source_video),
        "full_text": str(transcript_result.get("text", "")).strip(),
        "segments": compact_segments,
    }


def extract_audio(video_path: Path, temp_dir: Path, use_low_bitrate_mp3: bool) -> Path:
    audio_path = temp_dir / ("audio.mp3" if use_low_bitrate_mp3 else "audio.wav")
    command = ["ffmpeg", "-y", "-i", str(video_path), "-vn"]
    if use_low_bitrate_mp3:
        command.extend(["-ac", "1", "-ar", "16000", "-b:a", "32k", str(audio_path)])
    else:
        command.extend(["-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(audio_path)])
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return audio_path


def main() -> None:
    args = parse_args()

    source_video = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    model_path = Path(args.model_path).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not source_video.is_file():
        raise FileNotFoundError(f"Video not found: {source_video}")
    if not model_path.exists():
        raise FileNotFoundError(f"Model directory not found: {model_path}")

    duration_seconds = probe_duration_seconds(source_video)
    file_size_mb = source_video.stat().st_size / (1024 * 1024)
    use_low_bitrate_mp3 = (
        duration_seconds >= args.long_video_seconds or file_size_mb >= args.large_video_mb
    )

    with tempfile.TemporaryDirectory(prefix="video-distill-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        audio_path = extract_audio(source_video, temp_dir, use_low_bitrate_mp3)
        transcript_result = mlx_whisper.transcribe(
            str(audio_path),
            path_or_hf_repo=str(model_path),
            word_timestamps=True,
        )

    metadata = {
        "source_video": str(source_video),
        "model_path": str(model_path),
        "duration_seconds": round(duration_seconds, 3),
        "source_size_mb": round(file_size_mb, 3),
        "used_low_bitrate_mp3": use_low_bitrate_mp3,
    }
    enriched_result = dict(transcript_result)
    enriched_result["metadata"] = metadata

    transcript_json_path = output_dir / "transcript.json"
    transcript_text_path = output_dir / "transcript.txt"
    selection_input_path = output_dir / "selection_input.json"

    transcript_json_path.write_text(
        json.dumps(enriched_result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    transcript_text_path.write_text(
        build_readable_transcript(transcript_result.get("segments", [])),
        encoding="utf-8",
    )
    selection_input_path.write_text(
        json.dumps(build_selection_input(source_video, transcript_result), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Wrote {transcript_json_path}")
    print(f"Wrote {transcript_text_path}")
    print(f"Wrote {selection_input_path}")


if __name__ == "__main__":
    main()
