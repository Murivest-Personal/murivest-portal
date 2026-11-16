#!/usr/bin/env python3
"""Sweep portal surfaces to the 16px card geometry.

Only panel-shaped raw card patterns are upgraded (a container whose card
classes are followed by padding, or that end the class attribute); chips
and small inline elements are left untouched. Reports every replacement.
"""
import re
from pathlib import Path

ROOTS = [
    Path('/home/z/my-project/src/components/portal'),
    Path('/home/z/my-project/src/app/portal'),
]

# (pattern, replacement) — panel containers only
RULES = [
    # card containers with padding (padding may be followed by more classes)
    (re.compile(r'(?<!rounded-card )border border-border bg-card(?= p-)'),
     'rounded-card border border-border bg-card shadow-card'),
    # card container ending the class string (bare panel)
    (re.compile(r'(?<!rounded-card )border border-border bg-card(?=\")'),
     'rounded-card border border-border bg-card shadow-card'),
    # surface containers with padding
    (re.compile(r'(?<!rounded-card )border border-border bg-background(?= p-)'),
     'rounded-card border border-border bg-background shadow-card'),
    (re.compile(r'(?<!rounded-card )border border-border bg-background(?=\")'),
     'rounded-card border border-border bg-background shadow-card'),
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
            print(f'{rel}: {count} replacements')
            total += count

print(f'TOTAL: {total}')
