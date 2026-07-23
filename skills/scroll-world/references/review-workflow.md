# Approval-gated media review

Every generated still and paid video candidate is a human review checkpoint. Never batch,
parallelize, queue, or auto-continue image or video generation, even when the provider,
account, or tool supports concurrency.

## Candidate cycle

1. Generate one candidate only. Name it by slot and revision, for example
   `desktop-still-shop-r01.png`, `desktop-dive-shop-r01.mp4`, or
   `mobile-connector-03-r02.mp4`. Never overwrite a prior candidate.
2. Record model, mode, resolution, bitrate, duration, aspect ratio, prompt, input hashes,
   quality, job ID, pre/post credit balance, measured cost, output path, and creation time.
   Mark fields that do not apply to a still as such.
3. Present the actual full-resolution still in chat. For video, create a lightweight review
   proxy if the raw file is awkward to display, plus first, 25%, 50%, 75%, and final-frame
   stills. For seams, also show the required endpoint beside the candidate endpoint.
4. Ask for:
   - 👍 Approve.
   - 👎 Reject, followed by what is wrong.
   - Optional structured notes: camera movement, speed, composition, scene fidelity,
     style/colour consistency, artifacts, people/text/logos, framing/crop, opening frame,
     final frame, or seam continuity.
5. Stop. Silence, elapsed time, or a technically valid render is never approval.
6. On approval, mark the exact candidate immutable in the ledger. Only then continue.
7. On rejection, preserve it and log the notes. If the feedback is precise and the
   revision stays within the already approved allowance, a thumbs-down authorizes one
   revised candidate. Otherwise show the proposed prompt/input change and incremental
   cost, then ask before spending.
8. Repeat until approved or the user explicitly abandons/substitutes that slot.

Maintain `review/approval-ledger.md` (or equivalent project artifact) with one row per
image or video candidate: media type, slot, orientation, revision, job ID, settings,
credits, status, feedback, and approved filename. Include rejected generations in final
credit reporting.

## Dependency rules

### Scene stills

Generate and approve every still individually before generating any video that uses it.
An approval locks the exact pixels, not merely the prompt. After all stills are individually
approved, show a contact sheet containing only those approved files and request a separate
world-level cohesion approval. If a still is reopened after video generation starts, every
video directly or transitively conditioned by that still is potentially invalid; identify
and cost affected regeneration before proceeding.

### Architecture A — continuous legs

Approve leg 1 before extracting its final frame and generating leg 2. The next leg starts
only from the exact approved predecessor frame. If an earlier approved leg is later
replaced, every downstream leg is invalid because its starting pixels changed. Explain
the regeneration cost before reopening it.

### Architecture B — dives and connectors

Generate and approve every dive one at a time. Lock that approved dive set before creating
connectors. Then generate and approve connectors one at a time. Replacing a dive after
connector work invalidates its adjacent connector(s); replacing a connector affects only
that connector.

### Draft to production

Use an approved draft image/video to validate story, composition, prompt, and motion intent,
but production is a new stochastic render. Review every final-resolution candidate
independently. Do not upscale a draft and call it the production master.

### Desktop and native mobile

Finish and lock desktop first. Then create the independent 9:16 chain, one candidate at a
time, with its own ledger entries and approvals. Desktop approval never carries over to
portrait. An FFmpeg crop fallback spends no Higgsfield video credits, but still requires
visual approval because it may lose the focal subject.

## Review standards

Approve only when:

- Every still clearly represents its intended section, respects the approved composition,
  palette and art direction, contains no unwanted text/logos/artifacts, and has enough safe
  framing for its target orientation.
- The opening frame matches its required source.
- The intended subject/action is readable throughout.
- Camera velocity and direction satisfy the handoff contract.
- No unwanted text, logos, anatomy/geometry failures, flicker, or style drift remain.
- The final frame is usable for the next dependency.
- Architecture B connectors match both boundary frames and read naturally in both scroll
  directions.

After all candidates are approved, process and encode only the approved filenames. Never let
a shell glob accidentally select a rejected image or video revision.
