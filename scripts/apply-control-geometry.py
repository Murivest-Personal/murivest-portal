#!/usr/bin/env python3
"""Second pass: inputs, selects, and remaining panels to the control band.

- focus:border-gold -> focus:border-primary (sharp green focus, no glow)
- inputs/selects (bg-background with px-2..px-4) -> rounded-standard
- full-padding card panels (p-4/p-5) -> rounded-card + shadow-card
"""
import re
from pathlib import Path

ROOTS = [
    Path('/home/z/my-project/src/components'),
    Path('/home/z/my-project/src/app'),
]

RULES = [
    # Inputs: sharp primary-green focus instead of gold glow-less gold border
    (re.compile(r'focus:border-gold focus:outline-none'),
     'focus:border-primary'),
    # Input/select surfaces with compact horizontal padding -> 4-6px radius
    (re.compile(r'(?<!rounded-standard )border border-border bg-background(?= px-[234] )'),
     'rounded-standard border border-border bg-background'),
    # Card surfaces with full padding 4/5 -> 16px card geometry
    (re.compile(r'(?<!rounded-card )border border-border bg-card(?= p-[45](?![0-9]))'),
     'rounded-card border border-border bg-card shadow-card'),
]

total = 0
for root in ROOTS:
    for f in sorted(root.rglob('*.tsx')):
        text = f.read_text()
        count = 0
        for pattern, repl in RULES:
            text, n = pattern.subn(repl, text)
            count += n
        if count:
            f.write_text(text)
            rel = f.relative_to('/home/z/my-project')
            print(f'{rel}: {count}')
            total += count

print(f'TOTAL: {total}')
