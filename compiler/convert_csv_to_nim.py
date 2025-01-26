import csv

cu_flags = list(csv.reader(open("../rom/cu_flags.csv", "r")))
assembler_column_ind = cu_flags[0].index("ASSEMBLER INST")
translation = {v[assembler_column_ind]: ind for ind, v in enumerate(cu_flags[1:])}

f = open("cu_flags.nim", "w")
f.write("import tables\n")
f.write("let CU_FLAGS* = {\n")
for (inst, hexCode) in translation.items():
    if (inst):
        f.write("  \"{}\": {},\n".format(inst, hex(hexCode)))
f.write("}.toTable\n")
f.close()

print("Done")