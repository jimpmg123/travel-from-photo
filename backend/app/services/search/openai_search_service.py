# Removed in the tiered signal-fusion refactor (2026-05-26).
# Cascade-era single-shot OpenAI resolver replaced by:
#   - get_main_engine_service.analyze_gpt_main_voter (Method A independent voter)
#   - gpt_arbiter_service.run_gpt_arbiter (Method B re-rank judge)
# The new GPT files separate the two roles to avoid double-counting GPT's vote.
