# A.4 content-integrity check. Two properties, per 13e0041:
#   1. every h3's number matches its parent h2
#   2. every INTRA-document §N.M reference resolves to a real section
# Sections are headings OR top-level numbered list items (the spec's §8.4 convention).
# Cross-document references — those naming another doc, "audit", or "Spec" — are counted
# separately and NOT treated as dangling.
import re,sys
def sections(lines):
    out=set(); fence=False; cur=None
    for l in lines:
        if l.lstrip().startswith('```'): fence=not fence; continue
        if fence: continue
        m=re.match(r'^## (\d+)\.', l)
        if m: cur=m.group(1); out.add(cur); continue
        m=re.match(r'^#{3,4} (\d+)\.(\w+)', l)
        if m: out.add(m.group(1)); out.add(f'{m.group(1)}.{m.group(2)}')
        m=re.match(r'^(\d+)\. ', l)          # numbered list item under the current h2
        if m and cur: out.add(f'{cur}.{m.group(1)}')
    return out
def check(path):
    lines=open(path,encoding='utf-8').read().split('\n')
    heads=sections(lines)
    fence=False; cur=None; ok=bad=0; det=[]
    body=[]
    for l in lines:
        if l.lstrip().startswith('```'): fence=not fence; continue
        if fence: continue
        body.append(l)
        m=re.match(r'^## (\d+)\.', l)
        if m: cur=m.group(1); continue
        m=re.match(r'^### (\d+)\.(\w+)', l)
        if m and cur:
            if m.group(1)==cur: ok+=1
            else: bad+=1; det.append(f'    ### {m.group(1)}.{m.group(2)} under ## {cur}')
    # Scan LINE BY LINE, and treat the whole line as the qualifier's scope. A 40-char
    # lookbehind missed qualifiers that sit earlier in the same sentence ("Its §20 …",
    # "that document's §1.1 … §1.2 …"), which reported correct prose as dangling.
    # Heading lines are titles, not references, and are skipped.
    QUAL = re.compile(r'audit|Spec |spec\b|\.md|design spec|that document|Its `§|its `§')
    intra=[]; cross=0
    for line in body:
        if line.startswith('#'): continue
        qualified = bool(QUAL.search(line))
        for m in re.finditer(r'§(\d+)(?:\.(\w+))?', line):
            a,b=m.group(1),m.group(2)
            key=f'{a}.{b}' if b else a
            if qualified: cross+=1; continue
            if key not in heads: intra.append(key)
    intra=sorted(set(intra))
    print(f'  {path}')
    print(f'    h3 matches parent h2 : {ok} matching, {bad} mismatched')
    for d in det: print(d)
    print(f'    intra-doc references : {len(intra)} dangling' + (f' -> {", ".join("§"+x for x in intra)}' if intra else ''))
    print(f'    cross-doc references : {cross} (qualified by a document name — not checked here)')
    return bad,len(intra)
tb=td=0
for p in sys.argv[1:]:
    a,b=check(p); tb+=a; td+=b
print(f'\n  TOTAL: {tb} mismatched h3, {td} dangling intra-document references')
sys.exit(1 if (tb or td) else 0)
