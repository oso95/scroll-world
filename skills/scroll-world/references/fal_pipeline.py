#!/usr/bin/env python3
"""Small fal.ai helper for scroll-world asset generation.

Requires:
  pip install fal-client requests
  export FAL_KEY=...

The script uploads local conditioning frames to fal.ai, submits text-to-image or
image-to-video jobs, writes the raw JSON result, and optionally downloads the
returned media URL. It intentionally keeps provider-specific fields explicit so
new fal models can be tried without changing the scroll-world engine.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _load_deps():
    try:
        import fal_client  # type: ignore
        import requests  # type: ignore
    except ImportError as exc:
        print(
            "Missing dependency. Install with: pip install fal-client requests",
            file=sys.stderr,
        )
        raise SystemExit(2) from exc
    return fal_client, requests


def _need_key() -> None:
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY is not set. Export your fal.ai API key first.", file=sys.stderr)
        raise SystemExit(2)


def _read_prompt(path: str | None, prompt: str | None) -> str:
    if prompt:
        return prompt
    if path:
        return Path(path).read_text(encoding="utf-8")
    print("Provide --prompt or --prompt-file", file=sys.stderr)
    raise SystemExit(2)


def _is_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _media_url(value: str, fal_client: Any) -> str:
    """Return a public URL, uploading local files when needed."""
    if _is_url(value):
        return value
    path = Path(value)
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        raise SystemExit(2)
    return fal_client.upload_file(str(path))


def _jsonish(value: str) -> Any:
    if value[:1] in "[{\"" or value in {"true", "false", "null"}:
        return json.loads(value)
    return value


def _on_queue_update(update: Any) -> None:
    if isinstance(update, dict):
        status = update.get("status")
        logs = update.get("logs", [])
    else:
        status = getattr(update, "status", None)
        logs = getattr(update, "logs", [])
    if status:
        print(f"[fal] {status}", file=sys.stderr)
    for log in logs or []:
        if isinstance(log, dict):
            msg = log.get("message")
        else:
            msg = getattr(log, "message", None) or str(log)
        if msg:
            print(f"[fal] {msg}", file=sys.stderr)


def _extract_media_url(result: dict[str, Any]) -> str | None:
    # Video endpoints usually return {"video": {"url": "..."}}.
    video = result.get("video")
    if isinstance(video, dict) and video.get("url"):
        return str(video["url"])
    # Image endpoints may return {"images": [{"url": "..."}]} or {"image": {"url": "..."}}.
    images = result.get("images")
    if isinstance(images, list) and images and isinstance(images[0], dict) and images[0].get("url"):
        return str(images[0]["url"])
    image = result.get("image")
    if isinstance(image, dict) and image.get("url"):
        return str(image["url"])
    url = result.get("url")
    return str(url) if url else None


def _download(url: str, out_file: str) -> None:
    _, requests = _load_deps()
    out = Path(out_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with out.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)


def _write_json(path: str | None, payload: dict[str, Any]) -> None:
    data = json.dumps(payload, indent=2, ensure_ascii=False)
    if path:
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(data + "\n", encoding="utf-8")
    else:
        print(data)


def cmd_image(args: argparse.Namespace) -> None:
    _need_key()
    fal_client, _ = _load_deps()
    prompt = _read_prompt(args.prompt_file, args.prompt)
    payload: dict[str, Any] = {"prompt": prompt}
    if args.aspect_ratio:
        payload["aspect_ratio"] = args.aspect_ratio
    if args.image_size:
        payload["image_size"] = args.image_size
    if args.num_images:
        payload["num_images"] = args.num_images
    if args.seed is not None:
        payload["seed"] = args.seed
    for item in args.extra or []:
        key, value = item.split("=", 1)
        payload[key] = _jsonish(value)

    result = fal_client.subscribe(
        args.model,
        arguments=payload,
        with_logs=True,
        on_queue_update=_on_queue_update,
    )
    _write_json(args.out_json, result)
    url = _extract_media_url(result)
    if args.out_file and url:
        _download(url, args.out_file)
        print(f"downloaded {args.out_file}")


def cmd_video(args: argparse.Namespace) -> None:
    _need_key()
    fal_client, _ = _load_deps()
    prompt = _read_prompt(args.prompt_file, args.prompt)
    payload: dict[str, Any] = {
        "prompt": prompt,
        "image_url": _media_url(args.image, fal_client),
    }
    if args.end_image:
        payload[args.end_field] = _media_url(args.end_image, fal_client)
    if args.aspect_ratio:
        payload["aspect_ratio"] = args.aspect_ratio
    if args.resolution:
        payload["resolution"] = args.resolution
    if args.duration:
        payload["duration"] = str(args.duration)
    if args.seed is not None:
        payload["seed"] = args.seed
    if args.disable_safety_checker:
        payload["enable_safety_checker"] = False
    for item in args.extra or []:
        key, value = item.split("=", 1)
        payload[key] = _jsonish(value)

    result = fal_client.subscribe(
        args.model,
        arguments=payload,
        with_logs=True,
        on_queue_update=_on_queue_update,
    )
    _write_json(args.out_json, result)
    url = _extract_media_url(result)
    if args.out_file and url:
        _download(url, args.out_file)
        print(f"downloaded {args.out_file}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="fal.ai helper for scroll-world")
    sub = parser.add_subparsers(required=True)

    image = sub.add_parser("image", help="Generate a still image")
    image.add_argument("--model", default="fal-ai/flux-pro/v1.1-ultra")
    image.add_argument("--prompt-file")
    image.add_argument("--prompt")
    image.add_argument("--aspect-ratio", default="3:2")
    image.add_argument("--image-size")
    image.add_argument("--num-images", type=int)
    image.add_argument("--seed", type=int)
    image.add_argument("--extra", action="append", help="Extra JSON-ish field, e.g. --extra safety_tolerance=2")
    image.add_argument("--out-json")
    image.add_argument("--out-file")
    image.set_defaults(func=cmd_image)

    video = sub.add_parser("video", help="Generate an image-to-video clip")
    video.add_argument("--model", default="fal-ai/bytedance/seedance/v1/pro/image-to-video")
    video.add_argument("--prompt-file")
    video.add_argument("--prompt")
    video.add_argument("--image", required=True, help="Start image URL or local path")
    video.add_argument("--end-image", help="End image URL or local path for connectors")
    video.add_argument("--end-field", default="end_image_url", help="Use tail_image_url for fal models that require that field")
    video.add_argument("--aspect-ratio", default="16:9")
    video.add_argument("--resolution", default="1080p")
    video.add_argument("--duration", type=int, default=5)
    video.add_argument("--seed", type=int)
    video.add_argument("--disable-safety-checker", action="store_true")
    video.add_argument("--extra", action="append", help="Extra JSON-ish field, e.g. --extra camera_fixed=false")
    video.add_argument("--out-json")
    video.add_argument("--out-file")
    video.set_defaults(func=cmd_video)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
