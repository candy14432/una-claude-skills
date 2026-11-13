#!/usr/bin/env python3
"""Download the MLX Whisper model into a user-controlled local directory."""

from __future__ import annotations

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download a Hugging Face repository into a specific local folder."
    )
    parser.add_argument(
        "--repo",
        default="mlx-community/whisper-large-v3-turbo-q4",
        help="Hugging Face repository id.",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory where the model snapshot should be materialized.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    snapshot_download(
        repo_id=args.repo,
        local_dir=str(output_dir),
    )

    print(output_dir)


if __name__ == "__main__":
    main()
