#!/usr/bin/env python3
"""Build a first-pass highlights selection from a transcript, theme, and duration budget."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any

DEFAULT_MIN_CLIP_SECONDS = 18.0
DEFAULT_MAX_CLIP_SECONDS = 55.0
DEFAULT_MAX_GAP_SECONDS = 4.0
DEFAULT_PADDING_SECONDS = 1.2
DEFAULT_WORD_START_PADDING_SECONDS = 0.2
DEFAULT_WORD_END_PADDING_SECONDS = 0.35
DEFAULT_WORD_COLLISION_GUARD_SECONDS = 0.1
DEFAULT_MIN_WORD_TAIL_SECONDS = 0.05

COMMON_ZH_TOKENS = {
    "我们",
    "你看",
    "这个",
    "那个",
    "就是",
    "一个",
    "一些",
    "什么",
    "然后",
    "所以",
    "因为",
    "其实",
    "如果",
    "他们",
    "自己",
    "时候",
    "没有",
    "比较",
    "今天",
    "去年",
    "今年",
    "这里",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Auto-select continuous highlight clips from a transcript payload."
    )
    parser.add_argument(
        "--selection-input",
        required=True,
        help="Path to selection_input.json from transcribe_video.py.",
    )
    parser.add_argument("--theme", required=True, help="Desired highlight theme.")
    parser.add_argument(
        "--target-seconds",
        required=True,
        type=float,
        help="Target final video length in seconds.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Where to write the generated highlights JSON.",
    )
    parser.add_argument(
        "--min-clip-seconds",
        type=float,
        default=DEFAULT_MIN_CLIP_SECONDS,
        help="Minimum preferred clip length.",
    )
    parser.add_argument(
        "--max-clip-seconds",
        type=float,
        default=DEFAULT_MAX_CLIP_SECONDS,
        help="Maximum preferred clip length before truncation.",
    )
    parser.add_argument(
        "--max-gap-seconds",
        type=float,
        default=DEFAULT_MAX_GAP_SECONDS,
        help="Merge neighboring transcript segments when the gap is at or below this size.",
    )
    parser.add_argument(
        "--padding-seconds",
        type=float,
        default=DEFAULT_PADDING_SECONDS,
        help="Padding to add at the start and end of selected clips.",
    )
    return parser.parse_args()


def load_selection_input(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("segments"), list):
        raise ValueError("selection_input.json must be an object with a 'segments' list.")
    return payload


def tokenize_text(text: str) -> list[str]:
    normalized = text.lower()
    latin_tokens = re.findall(r"[a-z0-9]{2,}", normalized)
    chinese_tokens = re.findall(r"[\u4e00-\u9fff]{2,}", text)
    return latin_tokens + chinese_tokens


def expand_keywords(tokens: set[str]) -> set[str]:
    expanded: set[str] = set()
    for token in tokens:
        expanded.add(token)
        if re.fullmatch(r"[\u4e00-\u9fff]{4,}", token):
            for size in (2, 3, 4):
                if len(token) < size:
                    continue
                for index in range(0, len(token) - size + 1):
                    expanded.add(token[index : index + size])
    return {token for token in expanded if token not in COMMON_ZH_TOKENS}


def build_theme_keywords(theme: str, full_text: str) -> set[str]:
    keywords = expand_keywords(
        {token for token in tokenize_text(theme) if token not in COMMON_ZH_TOKENS}
    )
    if keywords:
        return keywords

    transcript_tokens = [token for token in tokenize_text(full_text) if token not in COMMON_ZH_TOKENS]
    return expand_keywords({token for token, _ in Counter(transcript_tokens).most_common(8)})


def score_segment(text: str, keywords: set[str]) -> float:
    tokens = tokenize_text(text)
    token_count = len(tokens)
    if token_count == 0 and not text.strip():
        return 0.0

    matched_keywords = {keyword for keyword in keywords if keyword in text.lower() or keyword in text}
    keyword_hits = sum(text.count(keyword) for keyword in matched_keywords)
    distinct_hits = len(matched_keywords)
    density = keyword_hits / max(token_count, 1)

    score = distinct_hits * 5.0
    score += keyword_hits * 1.5
    score += density * 12.0

    numerics = re.findall(r"\d+(?:\.\d+)?%?", text)
    score += min(len(numerics), 3) * 0.75

    if any(marker in text for marker in ("重点", "关键", "主要", "首先", "比如", "意味着", "目标")):
        score += 1.2

    return score


def group_segments_by_gap(
    segments: list[dict[str, Any]],
    max_gap_seconds: float,
) -> list[list[dict[str, Any]]]:
    groups: list[list[dict[str, Any]]] = []
    current_group: list[dict[str, Any]] = []

    for segment in segments:
        if not current_group:
            current_group = [segment]
            continue

        previous = current_group[-1]
        if float(segment["start"]) - float(previous["end"]) <= max_gap_seconds:
            current_group.append(segment)
            continue

        groups.append(current_group)
        current_group = [segment]

    if current_group:
        groups.append(current_group)

    return groups


def flatten_words(segments: list[dict[str, Any]]) -> list[dict[str, float | str]]:
    """Build a sorted word timeline from transcript segments when word timestamps exist."""
    timeline: list[dict[str, float | str]] = []
    for segment in segments:
        words = segment.get("words")
        if not isinstance(words, list):
            continue
        for word in words:
            if "start" not in word or "end" not in word:
                continue
            start = float(word["start"])
            end = float(word["end"])
            if end <= start:
                continue
            timeline.append(
                {
                    "start": start,
                    "end": end,
                    "word": str(word.get("word", "")).strip(),
                }
            )
    timeline.sort(key=lambda item: float(item["start"]))
    return timeline


def find_boundary_words(
    words: list[dict[str, float | str]],
    clip_start: float,
    clip_end: float,
) -> tuple[int | None, int | None]:
    """Return indices for the first and last words that overlap the clip span."""
    first_index: int | None = None
    last_index: int | None = None

    for index, word in enumerate(words):
        word_start = float(word["start"])
        word_end = float(word["end"])
        if word_end < clip_start:
            continue
        if word_start > clip_end:
            break
        if first_index is None:
            first_index = index
        last_index = index

    return first_index, last_index


def snap_clip_to_word_boundaries(
    start: float,
    end: float,
    words: list[dict[str, float | str]],
    max_clip_seconds: float,
) -> tuple[float, float]:
    """Adjust clip boundaries to avoid cutting into nearby spoken words."""
    if not words:
        return start, end

    first_index, last_index = find_boundary_words(words, start, end)
    if first_index is None or last_index is None:
        return start, end

    first_word = words[first_index]
    last_word = words[last_index]

    snapped_start = max(0.0, float(first_word["start"]) - DEFAULT_WORD_START_PADDING_SECONDS)
    if first_index > 0:
        previous_word_end = float(words[first_index - 1]["end"])
        snapped_start = max(
            snapped_start,
            previous_word_end + DEFAULT_WORD_COLLISION_GUARD_SECONDS,
        )

    snapped_end = float(last_word["end"]) + DEFAULT_WORD_END_PADDING_SECONDS
    if last_index + 1 < len(words):
        next_word_start = float(words[last_index + 1]["start"])
        snapped_end = min(
            snapped_end,
            next_word_start - DEFAULT_WORD_COLLISION_GUARD_SECONDS,
        )

    snapped_end = max(snapped_end, float(last_word["end"]) + DEFAULT_MIN_WORD_TAIL_SECONDS)
    snapped_end = max(snapped_end, snapped_start + DEFAULT_MIN_WORD_TAIL_SECONDS)

    if snapped_end - snapped_start > max_clip_seconds:
        clipped_end = min(snapped_end, snapped_start + max_clip_seconds)
        snapped_end = max(clipped_end, float(last_word["end"]) + DEFAULT_MIN_WORD_TAIL_SECONDS)
        if snapped_end - snapped_start > max_clip_seconds:
            snapped_start = max(0.0, snapped_end - max_clip_seconds)
            snapped_start = min(snapped_start, float(first_word["start"]))

    return snapped_start, snapped_end


def build_candidate_clips(
    segments: list[dict[str, Any]],
    keywords: set[str],
    min_clip_seconds: float,
    max_clip_seconds: float,
    max_gap_seconds: float,
    padding_seconds: float,
) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    grouped_segments = group_segments_by_gap(segments, max_gap_seconds)
    word_timeline = flatten_words(segments)

    for group in grouped_segments:
        segment_scores = [score_segment(str(segment.get("text", "")).strip(), keywords) for segment in group]
        for start_index, start_segment in enumerate(group):
            accumulated_text: list[str] = []
            accumulated_score = 0.0
            for end_index in range(start_index, len(group)):
                segment = group[end_index]
                accumulated_text.append(str(segment.get("text", "")).strip())
                accumulated_score += segment_scores[end_index]
                start = float(start_segment["start"])
                end = float(segment["end"])
                duration = end - start

                if duration > max_clip_seconds:
                    break
                if duration < min_clip_seconds:
                    continue
                if accumulated_score <= 0:
                    continue

                candidates.append(
                    finalize_candidate(
                        {
                            "start": start,
                            "end": end,
                            "score": accumulated_score,
                            "segments": accumulated_text,
                            "words": word_timeline,
                        },
                        padding_seconds,
                        max_clip_seconds,
                    )
                )

    filtered: list[dict[str, Any]] = []
    for candidate in candidates:
        duration = candidate["end"] - candidate["start"]
        if duration < min_clip_seconds:
            continue
        candidate["duration"] = duration
        candidate["score_per_second"] = candidate["score"] / max(duration, 1.0)
        filtered.append(candidate)
    return filtered


def finalize_candidate(candidate: dict[str, Any], padding_seconds: float, max_clip_seconds: float) -> dict[str, Any]:
    start = max(0.0, float(candidate["start"]) - padding_seconds)
    end = float(candidate["end"]) + padding_seconds
    if end - start > max_clip_seconds:
        end = start + max_clip_seconds

    start, end = snap_clip_to_word_boundaries(
        start,
        end,
        candidate.get("words", []),
        max_clip_seconds,
    )

    return {
        "start": round(start, 3),
        "end": round(end, 3),
        "score": round(float(candidate["score"]), 3),
        "summary_text": " ".join(candidate["segments"]),
    }


def choose_clips(candidates: list[dict[str, Any]], target_seconds: float) -> list[dict[str, Any]]:
    ranked = sorted(
        candidates,
        key=lambda item: (item["score_per_second"], math.log1p(item["score"])),
        reverse=True,
    )

    selected: list[dict[str, Any]] = []
    used_seconds = 0.0
    for candidate in ranked:
        duration = float(candidate["duration"])
        overlaps_existing = any(
            not (
                float(candidate["end"]) <= float(existing["start"])
                or float(candidate["start"]) >= float(existing["end"])
            )
            for existing in selected
        )
        if overlaps_existing:
            continue
        if selected and used_seconds + duration > target_seconds * 1.08:
            continue

        selected.append(candidate)
        used_seconds += duration
        if used_seconds >= target_seconds * 0.9:
            break

    return sorted(selected, key=lambda item: item["start"])


def build_output(theme: str, selected: list[dict[str, Any]]) -> dict[str, Any]:
    segments: list[dict[str, Any]] = []
    for index, item in enumerate(selected, start=1):
        summary_text = str(item["summary_text"])
        title = summary_text[:28].strip() or f"Highlight {index}"
        reason = f"High transcript relevance score for the requested theme. Score={item['score']:.2f}"
        segments.append(
            {
                "start": item["start"],
                "end": item["end"],
                "title": title,
                "reason": reason,
            }
        )
    return {"theme": theme, "segments": segments}


def main() -> None:
    args = parse_args()
    selection_input_path = Path(args.selection_input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    payload = load_selection_input(selection_input_path)
    keywords = build_theme_keywords(args.theme, str(payload.get("full_text", "")))
    candidates = build_candidate_clips(
        payload["segments"],
        keywords,
        args.min_clip_seconds,
        args.max_clip_seconds,
        args.max_gap_seconds,
        args.padding_seconds,
    )
    if not candidates:
        raise RuntimeError("No candidate highlight ranges were found for the requested theme.")

    selected = choose_clips(candidates, args.target_seconds)
    if not selected:
        raise RuntimeError("Could not fit any candidate highlight ranges into the requested target length.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(build_output(args.theme, selected), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
