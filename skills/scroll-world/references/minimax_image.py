#!/usr/bin/env python3
"""Render one MiniMax image still for the scroll-world pipeline."""

import argparse
import base64
import json
import os
import urllib.error
import urllib.request


ENDPOINTS = {
    "global_en": "https://api.minimax.io/v1/image_generation",
    "cn_zh": "https://api.minimaxi.com/v1/image_generation",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Generate a MiniMax image still.")
    prompt = parser.add_mutually_exclusive_group(required=True)
    prompt.add_argument("--prompt")
    prompt.add_argument("--prompt-file")
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="image-01")
    parser.add_argument(
        "--region",
        default=os.environ.get("MINIMAX_REGION", "global_en"),
        choices=sorted(ENDPOINTS),
    )
    parser.add_argument("--endpoint", default=os.environ.get("MINIMAX_IMAGE_ENDPOINT"))
    parser.add_argument("--aspect-ratio", default="3:2")
    parser.add_argument("--width", type=int)
    parser.add_argument("--height", type=int)
    parser.add_argument("--response-format", choices=("base64", "url"), default="base64")
    parser.add_argument("--seed", type=int)
    parser.add_argument("--n", type=int, default=1)
    parser.add_argument("--prompt-optimizer", choices=("true", "false"))
    parser.add_argument("--subject-reference", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=180)
    return parser.parse_args()


def read_prompt(args):
    if args.prompt_file:
        with open(args.prompt_file, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    return args.prompt.strip()


def compact_payload(args, prompt):
    payload = {
        "model": args.model,
        "prompt": prompt,
        "aspect_ratio": args.aspect_ratio,
        "response_format": args.response_format,
        "n": args.n,
    }
    optional = {
        "width": args.width,
        "height": args.height,
        "seed": args.seed,
        "subject_reference": args.subject_reference or None,
    }
    if args.prompt_optimizer is not None:
        optional["prompt_optimizer"] = args.prompt_optimizer == "true"
    payload.update({k: v for k, v in optional.items() if v is not None})
    return payload


def request_json(url, payload, token, timeout):
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"MiniMax HTTP {exc.code}: {body}") from exc


def find_first_image(response):
    data = response.get("data") or {}
    for key in ("image_urls", "images", "image_base64", "image"):
        value = data.get(key)
        if isinstance(value, list) and value:
            item = value[0]
            if isinstance(item, dict):
                return (
                    item.get("url")
                    or item.get("image_url")
                    or item.get("base64")
                    or item.get("image_base64")
                )
            return item
        if isinstance(value, str) and value:
            return value
    return None


def write_image(image_value, output, timeout):
    if image_value.startswith("http://") or image_value.startswith("https://"):
        with urllib.request.urlopen(image_value, timeout=timeout) as response:
            image_bytes = response.read()
    else:
        image_bytes = base64.b64decode(image_value.split(",", 1)[-1], validate=False)
    with open(output, "wb") as fh:
        fh.write(image_bytes)


def main():
    args = parse_args()
    token = os.environ.get("MINIMAX_API_KEY")
    if not token:
        raise SystemExit("MINIMAX_API_KEY is required")
    prompt = read_prompt(args)
    if not prompt:
        raise SystemExit("Prompt is empty")

    endpoint = args.endpoint or ENDPOINTS[args.region]
    response = request_json(endpoint, compact_payload(args, prompt), token, args.timeout)
    base_resp = response.get("base_resp") or {}
    if base_resp.get("status_code") not in (None, 0):
        message = base_resp.get("status_msg") or base_resp.get("message") or "request failed"
        raise SystemExit(f"MiniMax error {base_resp.get('status_code')}: {message}")

    image_value = find_first_image(response)
    if not image_value:
        raise SystemExit("MiniMax response did not include an image")
    write_image(image_value, args.output, args.timeout)
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
