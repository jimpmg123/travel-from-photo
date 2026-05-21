# Removed in the signal-fusion refactor.
# The CLIP gate ("is this even a travel photo?") is no longer a search-pipeline
# step — every signal runs and CLIP-style scene labels are consumed by the
# scorer as one optional signal among many. CLIP itself still lives in
# services/shared/clip_service.py and is used by the journal flow.
