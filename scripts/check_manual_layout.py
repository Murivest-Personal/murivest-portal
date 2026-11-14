#!/usr/bin/env python3
"""Objective per-page layout check for the manual PDF.

For every page: measure content bbox coverage and trailing blank space
(the flow-brief rule: no page should end with >30% trailing blank).
The cover (page 1) and ending (last page) are full-page designs, so
their expectation is full coverage anyway.
"""
import fitz  # pymupdf

PDF = '/home/z/my-project/download/murivest-portal-user-manual.pdf'

doc = fitz.open(PDF)
issues = []
for i, page in enumerate(doc, start=1):
    ph = page.rect.height
    pw = page.rect.width
    # text blocks + vector drawings, ignoring full-page background paints
    boxes = [fitz.Rect(b[:4]) for b in page.get_text('blocks') if b[4].strip()]
    for d in page.get_drawings():
        r = d['rect']
        if r.width > 2 or r.height > 2:
            if r.width >= pw * 0.98 and r.height >= ph * 0.98:
                continue  # page background paint
            if r.width >= pw * 0.98 and r.height < 2:
                continue  # full-width wash/stripe — still allow (not skipped)
            boxes.append(r)
    if not boxes:
        issues.append(f'page {i}: NO content found')
        continue
    u = fitz.Rect()
    for b in boxes:
        u |= b
    bottom_gap_pct = 100 * (ph - u.y1) / ph
    top_gap_pct = 100 * u.y0 / ph
    fill_pct = 100 * u.height / ph
    note = ''
    if i not in (1, len(doc)) and bottom_gap_pct > 30:
        note = '  <-- TRAILING BLANK TOO LARGE'
        issues.append(f'page {i}: trailing blank {bottom_gap_pct:.0f}%{note}')
    print(
        f'p{i:02d}: content y {u.y0:6.1f}..{u.y1:6.1f} of {ph:.0f} | '
        f'top gap {top_gap_pct:4.1f}% | bottom gap {bottom_gap_pct:4.1f}% | span {fill_pct:5.1f}%{note}'
    )
doc.close()
print()
if issues:
    print('ISSUES:'); [print(' -', s) for s in issues]
else:
    print('All pages OK: no page ends with >30% trailing blank space.')
