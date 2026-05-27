from __future__ import annotations

import base64
import json
import logging
from pathlib import Path
from typing import Any
import asyncio

from openai import AsyncOpenAI
from app.core.config import OPENAI_API_KEY, OPENAI_VISION_MODEL

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=OPENAI_API_KEY)


def _encode_image(image_path: Path) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


async def run_gpt_arbiter(
    image_path: str | Path,
    scored_candidates: list[dict[str, Any]],
    timeout_sec: float = 12.0
) -> list[dict[str, Any]]:
    path = Path(image_path)
    if not path.exists() or not scored_candidates:
        return scored_candidates

    try:
        base64_image = _encode_image(path)
        
        candidates_summary = []
        for idx, c in enumerate(scored_candidates):
            candidates_summary.append({
                "index": idx,
                "place_name": c.get("place_name") or c.get("formatted_address") or f"Candidate_{idx}",
                "aggregated_score": c.get("aggregated_score"),
                "signals": [
                    {"source": m.get("source"), "status": m.get("status"), "score": m.get("score")}
                    for m in c.get("member_signal_scores", [])
                ]
            })

        system_prompt = (
            "You are the Supreme Court Judge AI (Arbiter). Review the image and the list of place candidates "
            "along with their lower-tier API signals. Resolve contradictions and re-rank the existing candidates. "
            "Do not create new candidates or names. Return the original candidate items in the new finalized order. "
            "Respond strictly in JSON format with a top-level 'reordered_indices' array containing the 0-based "
            "indices of the candidates in their new rank order. "
            "Example format: {\"reordered_indices\": [1, 0, 2]}"
        )

        user_prompt = f"Scored Candidates Data:\n{json.dumps(candidates_summary)}"

        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=OPENAI_VISION_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            ),
            timeout=timeout_sec
        )

        content = response.choices[0].message.content
        if not content:
            return scored_candidates

        data = json.loads(content)
        reordered_indices = data.get("reordered_indices", [])

        if not reordered_indices or len(reordered_indices) != len(scored_candidates):
            return scored_candidates

        final_candidates = []
        for new_rank, old_idx in enumerate(reordered_indices, start=1):
            if 0 <= old_idx < len(scored_candidates):
                candidate = scored_candidates[old_idx]
                candidate["rank"] = new_rank
                final_candidates.append(candidate)

        return final_candidates if final_candidates else scored_candidates

    except Exception as e:
        logger.error(f"GPT arbiter re-ranking failed: {str(e)}")
        return scored_candidates