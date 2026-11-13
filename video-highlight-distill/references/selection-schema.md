# Highlight Selection Schema

Choose highlight ranges from the transcript artifacts and save them as JSON with this shape:

```json
{
  "theme": "One sentence summary of the desired highlights",
  "content_mode": "vlog | podcast/interview | meeting/demo | lecture/tutorial | talking-head/social clip",
  "output_style": "trailer | recap | educational summary | best moments | decision log",
  "segments": [
    {
      "start": 125.4,
      "end": 188.2,
      "title": "Optional short label",
      "reason": "Why this block deserves to be kept"
    }
  ]
}
```

Rules:

- Use `transcript.txt` as the primary selection input when the model is making editorial decisions.
- Use `selection_input.json` as the structured fallback for exact timestamp checks and downstream validation.
- `content_mode` describes what kind of source video this is and should influence segment length, pacing, and context preservation.
- `output_style` describes the kind of edit the user wants and should influence ordering, intensity, and completeness.
- `start` and `end` are seconds from the source video.
- `end` must be greater than `start`.
- Keep segments sorted by `start`.
- Keep segments non-overlapping.
- Prefer 2 to 8 substantial blocks over lots of tiny clips.
- Prefer multiple strong blocks over one oversized continuous block when that produces a better final edit.
- Select complete thoughts with enough lead-in and payoff to feel intentional.
- Prefer complete sentence endings over matching the target length exactly.
- Treat the requested target runtime as a soft budget. It is acceptable to run slightly long to finish a strong sentence or thought cleanly.
- Avoid clips that depend on missing context immediately before or after the cut.

Recommended process:

1. Read the user’s requested theme.
2. Read or infer the requested `content_mode` and `output_style`.
3. Scan `transcript.txt` for the strongest moments relevant to that theme and those constraints.
4. Choose sentence-level or utterance-level spans that stand on their own and work together as a coherent edit.
5. Expand timestamps to preserve natural continuity and complete endings.
6. Remove redundant points that repeat the same idea.
7. Keep the shortest set of clips that still tells the right story for the requested style.

Mode guidance:

- `vlog`: shorter, more energetic clips are usually acceptable.
- `podcast/interview`: keep more conversational context and longer exchanges.
- `meeting/demo`: prioritize decisions, updates, demos, and action items.
- `lecture/tutorial`: preserve teaching flow and complete examples.
- `talking-head/social clip`: prefer punchy standalone statements and clean hooks.

Output style guidance:

- `trailer`: optimize for curiosity, momentum, and contrast.
- `recap`: optimize for balanced coverage and clarity.
- `educational summary`: optimize for explanation quality and logical order.
- `best moments`: optimize for standout moments over completeness.
- `decision log`: optimize for decisions, rationale, owners, and next steps.

Validation guidance:

- The model should author the draft `highlights.draft.json`.
- `scripts/validate_highlights.py` should then be used to confirm the JSON shape, segment ordering, non-overlap, and timestamp bounds before rendering.
