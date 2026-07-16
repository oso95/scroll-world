# Pipeline: fal.ai-first scroll-world runbook

This runbook is provider-aware. The default stack is:

- still images: OpenAI image generation through the local `imagegen` skill/tool
- video: fal.ai `fal-ai/kling-video/v3/standard/image-to-video`
- encoding and QA: local `ffmpeg`, `ffprobe`, Node.js, and `jq`

Use Higgsfield only when the user explicitly chooses the legacy provider.

## 0. First-run setup

Run these checks before planning generation:

```bash
node -v
npm -v
ffmpeg -version
ffprobe -version
jq --version
```

Install the fal client in the project if it is missing:

```bash
npm init -y
npm install @fal-ai/client
```

Create `.env` locally. Support both formats in scripts and never print the value:

```bash
FAL_KEY=...
# or
export FAL_KEY=...
```

Add `.env` to `.gitignore` and provide only a placeholder `.env.example`.

## 1. Project layout

Use stable paths so failed local steps can resume without re-rendering paid jobs:

```bash
WORK=assets/generated/scroll-world/fal
PUBLIC=public/assets
mkdir -p "$WORK" "$PUBLIC/stills" "$PUBLIC/vid" docs/qa
```

Recommended generated files:

- `data/<world>.json` — ordered scene config and prompts
- `data/<world>-connectors.json` — connector prompts and scene pairs
- `assets/generated/<world>/fal/<scene>.raw.mp4`
- `assets/generated/<world>/fal/<scene>.response.json`
- `assets/generated/<world>/fal/<scene>.last.png`
- `public/assets/stills/<scene>.png`
- `public/assets/vid/<scene>.mp4`
- `public/assets/vid/<scene>-m.mp4`

## 2. Scene stills

Write one prompt per section using `prompts.md`. Generate stills with `imagegen`, then
copy the approved PNGs into the project. Do not continue to video until the stills read
as one cohesive world.

For each approved scene:

```bash
cp /path/to/generated.png "$WORK/<scene>.still.png"
cp "$WORK/<scene>.still.png" "$PUBLIC/stills/<scene>.png"
```

If the source still is not 16:9, keep it as the visual source but later regenerate the
public poster from the encoded 16:9 video frame.

## 3. fal.ai video generation script shape

Use Node ESM. The important parts are: load `.env` without logging secrets, pass local
start/end frames as `Blob`s, save the response JSON, handle both fal response shapes, and
resume from existing raw videos or response JSON.

```js
import { fal } from '@fal-ai/client';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

function loadEnvFile(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

function videoUrl(result) {
  return result?.video?.url || result?.data?.video?.url || '';
}

loadEnvFile();
if (!process.env.FAL_KEY) throw new Error('Missing FAL_KEY in .env');
fal.config({ credentials: process.env.FAL_KEY });

async function renderVideo({ endpoint, prompt, imagePath, endImagePath, outJson }) {
  const input = {
    prompt,
    start_image_url: new Blob([readFileSync(imagePath)], { type: 'image/png' }),
    duration: '5',
    generate_audio: false,
  };
  if (endImagePath) {
    input.end_image_url = new Blob([readFileSync(endImagePath)], { type: 'image/png' });
  }

  const result = await fal.subscribe(endpoint, {
    input,
    logs: true,
    onQueueUpdate(update) {
      if (update.status === 'IN_PROGRESS') {
        for (const log of update.logs || []) console.log(log.message);
      }
    },
  });

  writeFileSync(outJson, JSON.stringify(result, null, 2));
  const url = videoUrl(result);
  if (!url) throw new Error(`No video URL in ${outJson}`);
  return url;
}
```

Do not copy this snippet blindly as the whole app. Wrap it with scene iteration, retry,
download, and resume logic for the project.

## 4. Architecture A: continuous forward take

Use this for grounded, cinematic walkthroughs.

1. Render scene 0 from its still.
2. Extract its actual last frame.
3. Render scene 1 with `imagePath = previous actual last frame`.
4. Repeat until the finale.
5. Do not generate connectors; the legs are the journey.

Frame extraction:

```bash
ffmpeg -v error -sseof -0.15 -i "$WORK/<scene>.raw.mp4" \
  -frames:v 1 -q:v 2 "$WORK/<scene>.last.png"
```

Before rendering the next leg, inspect the last frame. If it does not look like a calm
forward drift, re-roll that leg. A bad handoff frame poisons every later leg.

## 5. Architecture B: dive clips plus connectors

Use this for miniature/diorama worlds where pulling out and flying to the next island is
part of the grammar.

For each scene:

1. Render a dive clip from the scene still.
2. Extract the first and last frame from the rendered raw video.

```bash
ffmpeg -v error -ss 0 -i "$WORK/<scene>.raw.mp4" \
  -frames:v 1 -q:v 2 "$WORK/<scene>.first.png"
ffmpeg -v error -sseof -0.15 -i "$WORK/<scene>.raw.mp4" \
  -frames:v 1 -q:v 2 "$WORK/<scene>.last.png"
```

For each connector:

- start image = previous scene's actual `last.png`
- end image = next scene's actual `first.png`
- never use the original still as a connector endpoint

Save every connector response JSON before download. If download or encode fails, resume
from the response JSON URL and do not re-render the connector.

## 6. Download and encode

Download the fal video URL into `*.raw.mp4`, then encode every clip for scrubbing. Normalize
all clips to 16:9. If raw dimensions are already slightly short such as `1280x716`, pad to
720 instead of stretching.

Desktop master:

```bash
ffmpeg -v error -y -i "$IN" -an \
  -vf "crop=iw:floor(iw*9/16/2)*2,unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$OUT"
```

If the input is `1280x716`, use padding instead:

```bash
ffmpeg -v error -y -i "$IN" -an \
  -vf "pad=1280:720:0:2,unsharp=5:5:0.8:5:5:0.0" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart "$OUT"
```

Mobile beta sibling:

```bash
ffmpeg -v error -y -i "$IN" -an \
  -vf "crop=iw:floor(iw*9/16/2)*2,scale=-2:720,unsharp=5:5:0.6:5:5:0.0" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g 4 -keyint_min 4 -sc_threshold 0 -movflags +faststart "$OUT_MOBILE"
```

If the master was padded from `1280x716`, pad first, then scale for mobile.

## 7. Engine wiring

Copy `references/scrub-engine.js` into the site and configure:

```js
mountScrollWorld(document.getElementById('world'), {
  diveScroll: 1.2,
  connScroll: 0.7,
  crossfade: 0.12,
  sections: [
    {
      id: 'scene-id',
      label: 'Scene Label',
      still: 'assets/stills/scene-id.png',
      clip: 'assets/vid/scene-id.mp4',
      clipMobile: 'assets/vid/scene-id-m.mp4',
      eyebrow: 'QUIET LABEL',
      title: 'A short headline.',
      body: 'One sentence from the visitor side.',
      tags: ['Tag'],
    },
  ],
  connectors: ['assets/vid/conn-01.mp4'],
  connectorsMobile: ['assets/vid/conn-01-m.mp4'],
});
```

Keep `connScroll` non-zero whenever connectors exist. A zero connector band makes the
experience collapse back into scene switching.

## 8. QA commands

Minimum checks:

```bash
node --check scripts/*.mjs
npm run qa:assets
npm run qa:chain
npm run serve
```

Browser checks:

- page title and all sections render
- console logs are empty
- videos use blob URLs
- `video.seekable.end(0) > 0`
- scrolling into a connector advances the connector video's `currentTime`
- mobile viewport has no horizontal overflow
- mobile build has `clipMobile` and `connectorsMobile` wired in config

Reduced motion can be verified at code level if the browser tool cannot emulate media
preferences: the engine must check `prefers-reduced-motion` and skip clip loading.

## 9. Legacy Higgsfield mapping

Only use this when explicitly selected:

- check `higgsfield workspace list`
- if auth fails, ask the user to run `higgsfield auth login`
- confirm model schema before batching
- use only models with start and end image support for connectors

Previously used CLI model mapping:

- `kling3_0`: `--mode std --sound off`, no `--resolution`
- `seedance_2_0`: `--mode std --resolution 1080p`
- `seedance_2_0_mini`: `--mode std --resolution 720p`

The rest of the seam method is identical: connectors use actual rendered boundary frames,
not stills.

## Failure notes to prevent repeats

- Save `.response.json` before download, because fal generation can succeed while local
  download or encoding fails.
- Check both fal URL shapes: `result.video.url` and `result.data.video.url`.
- Exclude `.env` from search output and final answers.
- Normalize raw video dimensions before QA.
- Regenerate posters from normalized video frames when source stills are not 16:9.
- Verify `connScroll` is non-zero when connectors exist.
- A listening port is not enough; verify the page loads in a browser.
