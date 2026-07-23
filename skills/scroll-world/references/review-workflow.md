# Approval-gated video review

Every paid video candidate is a human review checkpoint. Never batch, parallelize, queue,
or auto-continue video generation, even when the model/account supports concurrency.

## Candidate cycle

1. Generate one candidate only. Name it by slot and revision, for example
   `desktop-dive-shop-r01.mp4` or `mobile-connector-03-r02.mp4`. Never overwrite a prior
   candidate.
2. Record model, mode, resolution, bitrate, duration, aspect ratio, prompt, input hashes,
   job ID, pre/post credit balance, measured cost, output path, and creation time.
3. Create a lightweight review proxy if the raw file is awkward to display, plus first,
   25%, 50%, 75%, and final-frame stills. For seams, also show the required endpoint
   beside the candidate endpoint.
4. Present the actual video in chat and ask for:
   - 👍 Approve.
   - 👎 Reject, followed by what is wrong.
   - Optional structured notes: camera movement, speed, composition, scene fidelity,
     style/colour consistency, artifacts, people/text/logos, opening frame, final frame,
     or seam continuity.
5. Stop. Silence, elapsed time, or a technically valid render is never approval.
6. On approval, mark the exact candidate immutable in the ledger. Only then continue.
7. On rejection, preserve it and log the notes. If the feedback is precise and the
   revision stays within the already approved allowance, a thumbs-down authorizes one
   revised candidate. Otherwise show the proposed prompt/input change and incremental
   cost, then ask before spending.
8. Repeat until approved or the user explicitly abandons/substitutes that slot.

Maintain `review/approval-ledger.md` (or equivalent project artifact) with one row per
candidate: slot, orientation, revision, job ID, settings, credits, status, feedback, and
approved filename. Include rejected generations in final credit reporting.

## Dependency rules

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

Use an approved draft to validate story, prompt, and motion intent, but production is a
new stochastic render. Review every final-resolution clip independently. Do not upscale a
draft and call it the production master.

### Desktop and native mobile

Finish and lock desktop first. Then create the independent 9:16 chain, one candidate at a
time, with its own ledger entries and approvals. Desktop approval never carries over to
portrait. An FFmpeg crop fallback spends no Higgsfield video credits, but still requires
visual approval because it may lose the focal subject.

## Review standards

Approve only when:

- The opening frame matches its required source.
- The intended subject/action is readable throughout.
- Camera velocity and direction satisfy the handoff contract.
- No unwanted text, logos, anatomy/geometry failures, flicker, or style drift remain.
- The final frame is usable for the next dependency.
- Architecture B connectors match both boundary frames and read naturally in both scroll
  directions.

After all candidates are approved, encode only the approved filenames. Never let a shell
glob accidentally select a rejected revision.
