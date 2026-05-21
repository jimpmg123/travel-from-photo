# Removed in the signal-fusion refactor.
# GPT-4o vision is now one of N parallel signals collected by
# services/search/signal_collector_service.py. OCR text feeding is handled
# separately as its own signal (vision_ocr) so callers don't need to chain
# them inside one helper.
