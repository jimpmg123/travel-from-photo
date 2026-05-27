from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image

DEFAULT_CLIP_MODEL_ID = "openai/clip-vit-base-patch32"


def _import_clip_dependencies():
    try:
        import torch
        from transformers import CLIPModel, CLIPProcessor
    except ImportError as exc:
        raise RuntimeError(
            "CLIP dependencies are not installed. Install 'torch' and 'transformers' in the backend venv first."
        ) from exc

    return torch, CLIPModel, CLIPProcessor


@lru_cache(maxsize=1)
def load_clip_model(model_id: str = DEFAULT_CLIP_MODEL_ID) -> dict[str, Any]:
    torch, CLIPModel, CLIPProcessor = _import_clip_dependencies()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = CLIPModel.from_pretrained(model_id)
    processor = CLIPProcessor.from_pretrained(model_id)

    model.to(device)
    model.eval()

    return {
        "torch": torch,
        "device": device,
        "model": model,
        "processor": processor,
        "model_id": model_id,
    }


def _score_image_against_labels(
        image_path: str | Path,
        labels: list[str],
        prompt_template: str = "a travel photo of {label}",
        top_k: int = 5,
) -> dict[str, Any]:
    path = Path(image_path)

    if not path.exists():
        raise FileNotFoundError(f"Image file was not found: {path}")

    if not path.is_file():
        raise ValueError(f"Expected a file path, got: {path}")

    if not labels:
        raise ValueError("labels must contain at least one label.")

    clip_bundle = load_clip_model()
    torch = clip_bundle["torch"]
    device = clip_bundle["device"]
    model = clip_bundle["model"]
    processor = clip_bundle["processor"]

    prompts = [prompt_template.format(label=label) for label in labels]

    with Image.open(path) as image:
        image_rgb = image.convert("RGB")
        inputs = processor(text=prompts, images=image_rgb, return_tensors="pt", padding=True)

    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.no_grad():
        outputs = model(**inputs)
        probabilities = outputs.logits_per_image.softmax(dim=1)[0]

    scored_labels = [
        {
            "label": label,
            "prompt": prompt,
            "score": round(float(score), 6),
        }
        for label, prompt, score in zip(labels, prompts, probabilities.tolist(), strict=False)
    ]
    scored_labels.sort(key=lambda item: item["score"], reverse=True)

    top_matches = scored_labels[: max(top_k, 1)]

    return {
        "labels_tested": labels,
        "top_match": top_matches[0],
        "matches": top_matches,
    }