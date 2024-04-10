import csv
import sys

if len(sys.argv) > 1:
    f = open(sys.argv[1])
else:
    f = open("cu_flags.csv")

c = list(csv.reader(f))
f.close()

cl = [x[25] for x in c]
cl2 = [x[51] for x in c]
cl3 = [x[53] for x in c]

f = open("cu_rom.mem", "w")
f.write(" ".join(cl[1:]))
f.close()

f = open("cu_rom_2.mem", "w")
f.write(" ".join(cl2[1:]))
f.close()

f = open("cu_flag_conv.mem", "w")
f.write(" ".join(cl3[1:]))
f.close()

if len(sys.argv) > 2:
    f = open(sys.argv[2])
else:
    f = open("alu_flags.csv")

c = list(csv.reader(f))
f.close()

cl = [x[10] for x in c]
f = open("alu_rom.mem", "w")
f.write(" ".join(cl[1:]))
f.close()
