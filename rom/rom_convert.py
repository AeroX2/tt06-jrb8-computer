import sys
from pathlib import Path

f = open(sys.argv[1], "r").readlines()
j = []
for line in f[1:]:
    for g in line.split(" "):
        if "*" in g:
            q = [int(g.split("*")[1], 16)] * int(g.split("*")[0])
            j.extend(q)
        else:
            q = int(g, 16)
            j.append(q)

o = [hex(x)[2:] for x in j]
po = o + ["0"] * (256 - len(o))
y = " ".join(po)
f2 = open(f"{Path(sys.argv[1])}.mem", "w")
f2.write(y)
f2.close()
