"""Regenere Modele-Donnees.html depuis schema.prisma : python3 generer-page.py schema.prisma Modele-Donnees.html"""
import json, re, sys
SCHEMA, OUT = sys.argv[1], sys.argv[2]
src = open(SCHEMA).read().split("\n")

domains, cur, models, enums = [], None, [], []
doc = []
i = 0
in_cons = False
while i < len(src):
    line = src[i]
    if "CONTRAINTES SQL" in line:
        in_cons = True
    m = None if in_cons else re.match(r"^// (\d)\. (.+)$", line)
    if m:
        cur = m.group(2).strip(); domains.append(cur)
    if line.startswith("///"):
        doc.append(line[3:].strip()); i += 1; continue
    m = re.match(r"^(model|enum) (\w+) \{", line)
    if m:
        kind, name = m.groups(); body = []
        i += 1
        while not src[i].startswith("}"):
            body.append(src[i]); i += 1
        if kind == "enum":
            vals = [re.match(r"\s*(\w+)\s*(//\s*(.*))?", b) for b in body if b.strip() and not b.strip().startswith("//")]
            enums.append({"name": name, "domain": cur, "values": [[v.group(1), (v.group(3) or "").strip()] for v in vals if v]})
        else:
            fields, attrs = [], []
            for b in body:
                s = b.strip()
                if not s or s.startswith("//"): continue
                if s.startswith("@@"): attrs.append(s); continue
                fm = re.match(r"(\w+)\s+([\w\[\]?]+)\s*(.*)$", s)
                if not fm: continue
                fname, ftype, rest = fm.groups()
                comment = ""
                if "//" in rest:
                    rest, comment = rest.split("//", 1)
                is_rel = "@relation" in rest or ftype.rstrip("[]?") in [x for x in []]
                fields.append({"n": fname, "t": ftype, "a": rest.strip(), "c": comment.strip()})
            models.append({"name": name, "domain": cur, "doc": " ".join(doc), "fields": fields, "attrs": attrs})
        doc = []
    else:
        if not line.startswith("///"): doc = [] if line.strip() == "" or line.startswith("//") and not line.startswith("///") else doc
    i += 1

names = {m["name"] for m in models} | {e["name"] for e in enums}
for m in models:
    for f in m["fields"]:
        base = f["t"].rstrip("?").rstrip("[]").rstrip("?")
        f["rel"] = base in {x["name"] for x in models}
        f["enum"] = base in {e["name"] for e in enums}
        f["d"] = re.findall(r"\[(D\d+|F-[A-Z]+-\d+)\]", f["c"])
    m["d"] = sorted(set(re.findall(r"\[(D\d+|F-[A-Z]+-\d+)\]", m["doc"])), key=lambda x: (len(x), x))
for e in enums: pass

tail = "\n".join(src)
cons = tail[tail.index("// CONTRAINTES SQL"):].split("\n")[2:]
constraints = "\n".join(l[3:] if l.startswith("// ") else l[2:] for l in cons)

data = {"domains": domains, "models": models, "enums": enums, "constraints": constraints}
html = open(OUT + ".tpl").read().replace("__DATA__", json.dumps(data, ensure_ascii=True).replace("</", "<\\/"))
open(OUT, "w").write(html)
print(len(domains), "domaines,", len(models), "modeles,", len(enums), "enums")
