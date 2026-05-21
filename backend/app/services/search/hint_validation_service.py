# Removed in the signal-fusion refactor.
# "Does the resolved country match the user's hint?" was a binary
# pass/fail gate that didn't fit fusion. The same idea now lives in
# services/search/hint_reweighting_service.py as a score multiplier
# (match boosts the candidate; mismatch penalizes it) so hints can sway
# scoring without throwing away candidates outright.
