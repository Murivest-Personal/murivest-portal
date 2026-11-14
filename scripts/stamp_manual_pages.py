#!/usr/bin/env python3
"""Stamp page numbers onto the Murivest investor manual PDF.

Scheme (typesetting/pagination.md): cover is hidden page 1; body pages get
centered bare Arabic numerals starting at 1 on the first page after the
cover; the dark ending page is numbered in ivory. No 'Page X of Y' totals.
"""
import io

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

SRC = '/home/z/my-project/download/murivest-portal-user-manual.pdf'
DST = SRC  # in-place rewrite via temp buffer

reader = PdfReader(SRC)
writer = PdfWriter()

n = len(reader.pages)
box = reader.pages[0].mediabox
w, h = float(box.width), float(box.height)

INK = (0.427, 0.478, 0.435)      # #6D7A6F muted green for light pages
IVORY = (0.98, 0.976, 0.965)     # for the dark ending page

for i, page in enumerate(reader.pages):
    if i == 0:
        writer.add_page(page)  # cover: no visible number
        continue
    color = IVORY if i == n - 1 else INK
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(w, h))
    c.setFont('Helvetica', 9)
    c.setFillColorRGB(*color)
    c.drawCentredString(w / 2.0, 22, str(i))  # body numbering starts at 1
    c.save()
    buf.seek(0)
    overlay = PdfReader(buf)
    page.merge_page(overlay.pages[0])
    writer.add_page(page)

with open(DST + '.tmp', 'wb') as fh:
    writer.write(fh)

import os
os.replace(DST + '.tmp', DST)
print(f'stamped {n - 1} body pages (cover unnumbered) at {w:.0f}x{h:.0f}pt')
