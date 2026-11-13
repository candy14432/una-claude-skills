# video-highlight-distill skill

[English](README.md) | [简体中文](README.zh-CN.md)

`video-highlight-distill` is a Codex/Claude/Agent skill repository for turning a long source video into a shorter highlight cut. The skill transcribes the video with `mlx-whisper`, has the model choose highlight ranges around a requested theme, validates those ranges, and renders a final stitched highlight video with `ffmpeg`.

For now, this skill is macOS-only because the transcription path depends on `mlx-whisper`. A future version can expand to Windows by adding either a Windows-compatible Whisper backend or a transcription API workflow.

Repository: [github.com/Troyanovsky/video-highlight-distill](https://github.com/Troyanovsky/video-highlight-distill)

## What This Skill Is For

This repository contains one skill: `video-highlight-distill`.

Have you ever recorded an hour of raw video footage but kept putting off turning it into a vlog, video podcast, or highlight reel? If so, this skill is for you.

Use it when you want an agent to:

- turn a long video into a shorter highlights edit
- preserve a specific theme, takeaway, or talking point
- generate transcript artifacts that can be reviewed before rendering
- cut and concatenate the selected ranges into a final output video

The repository also includes the helper scripts and reference material the skill uses:

- `scripts/setup.sh`
- `scripts/transcribe_video.py`
- `scripts/validate_highlights.py`
- `scripts/auto_select_highlights.py`
- `scripts/render_highlight_video.py`
- `scripts/download_model.py`
- `references/selection-schema.md`

## Install The Skill

To download and install the skill, run:

```bash
npx skills add Troyanovsky/video-highlight-distill
```

Depending on your skill manager configuration, the skill may be installed in one of these locations:

- `.agents/skills/video-highlight-distill`
- `.claude/skills/video-highlight-distill`
- `~/.agents/skills/video-highlight-distill`
- `~/.claude/skills/video-highlight-distill`

## How The Skill Works

The skill is designed around a simple workflow:

1. Ask for the editing goal up front.
   Before doing any setup or transcription, the agent should ask for:
   - the target final video length
   - the key points, theme, or takeaway to highlight
   - the content mode
   - the output style
   - the source video path if it has not already been provided
2. Check prerequisites.
   The agent confirms `python3`, `ffmpeg`, and `ffprobe` are available and checks whether the repo already has `.venv` and `models/whisper-large-v3-turbo-q4`.
3. Run setup.
   `scripts/setup.sh` creates `.venv`, installs Python dependencies, and downloads the Whisper model into the project-local `models/` directory if needed.
4. Transcribe the video.
   `scripts/transcribe_video.py` extracts audio, runs `mlx-whisper`, and writes:
   - `transcript.json`
   - `transcript.txt`
   - `selection_input.json`
5. Select highlight ranges.
   The model reads `transcript.txt` as the primary editorial input and uses `selection_input.json` when exact structured timestamps are needed. It should usually choose multiple strong highlight segments that will be stitched together into the final video, then write a draft `highlights.draft.json` using the schema in `references/selection-schema.md`.
6. Pause for confirmation.
   Before cutting any video, the agent should show the selected segments to the user with timestamps, a short synopsis of each segment, and the estimated combined runtime, then wait for approval or requested edits.
7. Validate and refine.
   `scripts/validate_highlights.py` verifies shape, ordering, overlap, and timestamp bounds before rendering. `scripts/auto_select_highlights.py` remains available as a heuristic fallback if a quick first pass is needed.
8. Render the final video.
   `scripts/render_highlight_video.py` cuts the selected ranges from the source video and concatenates them into one highlight video.

The skill supports being installed in either `.agents/` or `.claude/`, and from either a repo-local location or a global home-directory location. The documented commands first resolve the skill directory, then invoke the scripts from there.

## What You Need To Provide

Before the agent can produce a highlight video, you need to provide:

- the target final video length
- the highlight theme or main idea
- the content mode
- the output style
- the source video path

At the start of the interaction, the skill should ask for the target final length, the key points or theme to highlight, the content mode, and the output style if they are missing. If the target final length is still missing, the skill should ask for it before clip selection because the selection step uses a duration budget.

Recommended content modes:

- `vlog`
- `podcast/interview`
- `meeting/demo`
- `lecture/tutorial`
- `talking-head/social clip`

Recommended output styles:

- `trailer`
- `recap`
- `educational summary`
- `best moments`
- `decision log`

## Running The Skill In A Project

Run the workflow from the target project or working directory where you want these artifacts to live:

- `.venv`
- `models/whisper-large-v3-turbo-q4`
- transcript outputs
- generated highlight JSON
- final rendered video

The skill documentation in [SKILL.md](/Users/guodongzhao/Documents/GitHub/video-distill/SKILL.md) includes the exact command flow, including the `SKILL_DIR` resolution snippet that works across local and global `.agents`/`.claude` installs.

## Change Log

- Latest: the skill now asks for `content mode` and `output style` up front, and presents selected segments in chat for confirmation before validation and final rendering.
- Earlier: highlight selection switched to a model-directed flow using `transcript.txt` as the main editorial input, with validation via `scripts/validate_highlights.py`, fallback auto-selection, and word-timestamp boundary handling to reduce clipped endings.
- Earlier: the documentation added the sandbox and elevated-permission note for `mlx-whisper` transcription in Codex-like environments.
