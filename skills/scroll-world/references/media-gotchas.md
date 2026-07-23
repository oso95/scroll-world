# Media failure guide

- **Visible seam pop:** endpoint came from a concept still rather than the neighbouring rendered clip. Re-extract and regenerate. A crossfade cannot hide a large content mismatch.
- **Seam reads like rewind:** camera velocity reversed across the boundary. Use architecture A for grounded walkthroughs; every leg must finish and begin with the same gentle forward drift. Architecture B’s pull-out is suitable only when an aerial miniature hop is intentional.
- **Frozen at frame zero:** hosting has no useful byte-range seekability. Keep the engine’s Blob fetch path.
- **Huge clips:** all-intra encoding was used. Desktop GOP 8 is the baseline; native mobile GOP 4. Tighten only after measured decoder issues.
- **Soft output:** source was downscaled/upscaled or over-compressed. Encode at native resolution, about CRF 20, with restrained sharpening. Never upscale Kling’s native 720p output.
- **White box around an island:** match the page background exactly or run `knockout.py` before poster encoding. Video itself still needs a full-frame solid-background source.
- **503 or apparent credit race:** inspect the job JSON/error and live workspace balance. Retry only the failed job; do not restart successful batches.
- **Repeated content-filter rejection:** retry because some decisions are non-deterministic; then remove trigger terms and describe an empty, unoccupied, architectural scene. If still blocked, use the approved alternate provider for only that clip with the same endpoints and inspect the resulting render-character shift. Never silently leave a missing clip.
- **Kling flag errors:** query the live model schema. Historically `kling3_0` accepts start/end images, has no resolution flag, and needs sound disabled; do not assume stale flags.
- **Model accepts only a reference image:** reference conditioning is not frame locking. It cannot guarantee a seam and is not eligible for the chain.
- **Wrong adjacent frame or missing file on macOS:** interactive zsh arrays are 1-indexed. Run array-driven pipeline blocks as `#!/bin/bash` scripts; keep them Bash 3.2-safe and avoid associative arrays.
- **Blank video on iOS:** retain muted/playsinline, still-until-first-painted-frame, and first-gesture play/pause priming.
- **Phone freezes on fast flick:** confirm the native mobile file is actually selected, then measure. GOP 4/720-wide portrait plus seek coalescing is the baseline; GOP 2 is an evidence-based fallback.
- **Mobile URL-bar jump:** do not relayout for touch height-only resize; relayout on width/orientation change.
- **Portrait crop loses subject:** the user received desktop fallback or an explicitly approved crop, not a native portrait chain. Native 9:16 scenes need their own matching posters and every connector regenerated from portrait boundary frames.
- **Mixed look at one seam:** models or still sources changed mid-chain. Use one still source and one video model throughout except an explicitly reviewed filter fallback.
