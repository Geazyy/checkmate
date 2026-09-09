# OMR regression fixture

`checkmate-50-captured.jpg` is cropped from the real device capture supplied for the scanner bug. The expected answers were transcribed visually from the filled bubbles, independently of the answer key and scanner output. Q35 is intentionally blank.

The dark, bright, rotated, reduced-resolution, and slight-crop files exercise preprocessing and geometry rejection. `checkmate-50-grid-large.jpg` and `omr-q35-debug.png` are visual inspection aids and are not scanner inputs.

`checkmate-25-closeup.jpg` is the photo region cropped from the user's September 8 phone screenshot (not the original camera file). Nearby bubble outlines join during contrast normalization. Its independently transcribed answers are in `checkmate-25-closeup-expected.json`; Q11 is blank. `scripts/test-omr-closeup.cjs` tests the actual detector through the Sharp input adapter, including blur, reduced resolution, compression and incomplete-sheet rejection. This does not substitute for native camera testing.

`checkmate-25-color.jpg` is the full answer-sheet photo supplied September 9, converted to JPEG without cropping. Q11 has red C; Q12 has graphite A and red B and must be `multiple`, never a selected single answer. Expected marks are transcribed in `checkmate-25-color-expected.json`. `scripts/test-omr-color.cjs` also creates in-memory blue, green and black variants of the red marks; these are synthetic color tests, not additional real-world captures.
