#!/usr/bin/env python3
"""Validate a .docx file produced by the Hive beta report generator."""

import sys
import zipfile
import os

def validate(path):
    if not os.path.exists(path):
        print(f'FAIL: file not found: {path}')
        sys.exit(1)

    if not path.endswith('.docx'):
        print(f'FAIL: not a .docx file: {path}')
        sys.exit(1)

    try:
        with zipfile.ZipFile(path, 'r') as z:
            names = z.namelist()
            if 'word/document.xml' not in names:
                print('FAIL: missing word/document.xml — not a valid docx')
                sys.exit(1)
            xml = z.read('word/document.xml').decode('utf-8', errors='replace')
    except zipfile.BadZipFile:
        print(f'FAIL: file is not a valid zip/docx: {path}')
        sys.exit(1)

    size = os.path.getsize(path)
    if size < 2000:
        print(f'FAIL: file suspiciously small ({size} bytes) — likely empty')
        sys.exit(1)

    # Check for common docx corruption patterns
    if '<w:body/>' in xml or xml.count('<w:p>') + xml.count('<w:p ') < 5:
        print('WARN: very few paragraphs found — document may be incomplete')

    print(f'OK: {path} ({size:,} bytes, {xml.count("<w:p>")+xml.count("<w:p ")} paragraphs)')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python validate.py <file.docx>')
        sys.exit(1)
    validate(sys.argv[1])
