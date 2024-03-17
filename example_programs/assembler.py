import re
import pathlib
import argparse


def check_mov(args):
    r = re.match(r"([abcd]) ([abcd])", args)
    if r is not None:
        return r.group(1) != r.group(2)


def check_load(args):
    r = re.match(r"ram\[[abcd]\] [abcd]", args)
    if r is not None:
        return True
    r = re.match(r"ram\[[0-9]+\] [abcd]", args)
    if r is not None:
        return True
    r = re.match(r"rom [abcd] [0-9]+", args)
    return r is not None


def check_save(args):
    r = re.match(r"[abcd] ram", args)
    if r is not None:
        return True
    r = re.match(r"[abcd] ram\[[abcd]\]", args)
    if r is not None:
        return True
    r = re.match(r"[abcd] ram\[[0-9]+\]", args)
    if r is not None:
        return True
    r = re.match(r"[abcd] mar", args)
    return r is not None


operations = {
    "nop": lambda x: x == "",
    "mov": check_mov,
    "cmp": re.compile(r"([abcd]) ([abcd])").match,
    "jmp": re.compile(r"(\.?(<=|<|=|>|>=) [abcd])|(.+)").match,
    "jmpr": re.compile(r"(\.?(<=|<|=|>|>=) [abcd])|(.+)").match,
    "opp": re.compile(r"").match,
    "load": check_load,
    "save": check_save,
    "in": re.compile(r"[abcd]").match,
    "out": re.compile(r"[abcd]").match,
    "pause": lambda x: x == "",
}

translation = {
    "nop": 0x0,
    "mov a b": 0x10,
    "mov a c": 0x11,
    "mov a d": 0x12,
    "mov b a": 0x13,
    "mov b c": 0x14,
    "mov b d": 0x15,
    "mov c a": 0x16,
    "mov c b": 0x17,
    "mov c d": 0x18,
    "mov d a": 0x19,
    "mov d b": 0x1A,
    "mov d c": 0x1B,
    "cmp a a": 0x20,
    "cmp a b": 0x21,
    "cmp a c": 0x22,
    "cmp a d": 0x23,
    "cmp b a": 0x24,
    "cmp b b": 0x25,
    "cmp b c": 0x26,
    "cmp b d": 0x27,
    "cmp c a": 0x28,
    "cmp c b": 0x29,
    "cmp c c": 0x2A,
    "cmp c d": 0x2B,
    "cmp d a": 0x2C,
    "cmp d b": 0x2D,
    "cmp d c": 0x2E,
    "cmp d d": 0x2F,
    "jmp {label}": 0x30,
    "jmp = {label}": 0x31,
    "jmp != {label}": 0x32,
    "jmp <= {label}": 0x33,
    "jmp < {label}": 0x34,
    "jmp > {label}": 0x35,
    "jmp >= {label}": 0x36,
    "jmp .<= {label}": 0x37,
    "jmp .< {label}": 0x38,
    "jmp .> {label}": 0x39,
    "jmp .>= {label}": 0x3A,
    "jmpr {number}": 0x40,
    "jmpr = {number}": 0x41,
    "jmpr != {number}": 0x42,
    "jmpr < {number}": 0x43,
    "jmpr <= {number}": 0x44,
    "jmpr > {number}": 0x45,
    "jmpr >= {number}": 0x46,
    "jmpr .< {number}": 0x47,
    "jmpr .<= {number}": 0x48,
    "jmpr .> {number}": 0x49,
    "jmpr .>= {number}": 0x4A,
    "opp 0": 0x50,
    "opp 1": 0x51,
    "opp -1": 0x52,
    "opp a": 0x53,
    "opp b": 0x54,
    "opp c": 0x55,
    "opp d": 0x56,
    "opp ~a": 0x57,
    "opp ~b": 0x58,
    "opp ~c": 0x59,
    "opp ~d": 0x5A,
    "opp -a": 0x5B,
    "opp -b": 0x5C,
    "opp -c": 0x5D,
    "opp -d": 0x5E,
    "opp a+1": 0x60,
    "opp b+1": 0x61,
    "opp c+1": 0x62,
    "opp d+1": 0x63,
    "opp a-1": 0x64,
    "opp b-1": 0x65,
    "opp c-1": 0x66,
    "opp d-1": 0x67,
    "opp a+b": 0x68,
    "opp a+c": 0x69,
    "opp a+d": 0x6A,
    "opp b+a": 0x6B,
    "opp b+c": 0x6C,
    "opp b+d": 0x6D,
    "opp c+a": 0x6E,
    "opp c+b": 0x6F,
    "opp c+d": 0x70,
    "opp d+a": 0x71,
    "opp d+b": 0x72,
    "opp d+c": 0x73,
    "opp a.+b": 0x74,
    "opp a.+c": 0x75,
    "opp a.+d": 0x76,
    "opp b.+a": 0x77,
    "opp b.+c": 0x78,
    "opp b.+d": 0x79,
    "opp c.+a": 0x7A,
    "opp c.+b": 0x7B,
    "opp c.+d": 0x7C,
    "opp d.+a": 0x7D,
    "opp d.+b": 0x7E,
    "opp d.+c": 0x7F,
    "opp a-b": 0x80,
    "opp a-c": 0x81,
    "opp a-d": 0x82,
    "opp b-a": 0x83,
    "opp b-c": 0x84,
    "opp b-d": 0x85,
    "opp c-a": 0x86,
    "opp c-b": 0x87,
    "opp c-d": 0x88,
    "opp d-a": 0x89,
    "opp d-b": 0x8A,
    "opp d-c": 0x8B,
    "opp a&b": 0x8C,
    "opp a&c": 0x8D,
    "opp a&d": 0x8E,
    "opp b&c": 0x8F,
    "opp b&d": 0x90,
    "opp c&d": 0x91,
    "opp a|b": 0x92,
    "opp a|c": 0x93,
    "opp a|d": 0x94,
    "opp b|c": 0x95,
    "opp b|d": 0x96,
    "opp c|d": 0x97,
    "opp a>>b": 0x98,
    "opp a>>c": 0x99,
    "opp a>>d": 0x9A,
    "opp b>>a": 0x9B,
    "opp b>>c": 0x9C,
    "opp b>>d": 0x9D,
    "opp c>>a": 0x9E,
    "opp c>>b": 0x9F,
    "opp c>>d": 0xA0,
    "opp d>>a": 0xA1,
    "opp d>>b": 0xA2,
    "opp d>>c": 0xA3,
    "opp a<<b": 0xA4,
    "opp a<<c": 0xA5,
    "opp a<<d": 0xA6,
    "opp b<<a": 0xA7,
    "opp b<<c": 0xA8,
    "opp b<<d": 0xA9,
    "opp c<<a": 0xAA,
    "opp c<<b": 0xAB,
    "opp c<<d": 0xAC,
    "opp d<<a": 0xAD,
    "opp d<<b": 0xAE,
    "opp d<<c": 0xAF,
    "load ram[a] a": 0xB0,
    "load ram[a] b": 0xB1,
    "load ram[a] c": 0xB2,
    "load ram[a] d": 0xB3,
    "load ram[b] a": 0xB4,
    "load ram[b] b": 0xB5,
    "load ram[b] c": 0xB6,
    "load ram[b] d": 0xB7,
    "load ram[c] a": 0xB8,
    "load ram[c] b": 0xB9,
    "load ram[c] c": 0xBA,
    "load ram[c] d": 0xBB,
    "load ram[d] a": 0xBC,
    "load ram[d] b": 0xBD,
    "load ram[d] c": 0xBE,
    "load ram[d] d": 0xBF,
    "load rom a {number}": 0xC0,
    "load rom b {number}": 0xC1,
    "load rom c {number}": 0xC2,
    "load rom d {number}": 0xC3,
    "load ram[{number}] a": 0xC4,
    "load ram[{number}] b": 0xC5,
    "load ram[{number}] c": 0xC6,
    "load ram[{number}] d": 0xC7,
    "set a rampage": 0xC8,
    "set b rampage": 0xC9,
    "set c rampage": 0xCA,
    "set d rampage": 0xCB,
    "save a mar": 0xD0,
    "save b mar": 0xD1,
    "save c mar": 0xD2,
    "save d mar": 0xD3,
    "save a ram[current]": 0xD4,
    "save b ram[current]": 0xD5,
    "save c ram[current]": 0xD6,
    "save d ram[current]": 0xD7,
    "save a ram[a]": 0xD8,
    "save b ram[c]": 0xD9,
    "save c ram[d]": 0xDA,
    "save d ram[d]": 0xDB,
    "save a ram[{number}]": 0xDC,
    "save b ram[{number}]": 0xDD,
    "save c ram[{number}]": 0xDE,
    "save d ram[{number}]": 0xDF,
    "in a": 0xE0,
    "in b": 0xE1,
    "in c": 0xE2,
    "in d": 0xE3,
    "out a": 0xF0,
    "out b": 0xF1,
    "out c": 0xF2,
    "out d": 0xF3,
    #'out 0':  0xb3, #TODO: Implement this
    #'out 1':  0xb4,
    #'out -1': 0xb5,
    "pause": 0xFF,
}

translation_stage_two = list(
    filter(lambda x: "{label}" in x or "{number}" in x, translation)
)


def opp_to_hex(line):
    global offset

    if line in translation:
        offset += 1
        return [translation[line]]

    for instruction in translation_stage_two:
        match_whole_ins = "^" + re.escape(instruction) + "$"

        ins_temp = match_whole_ins.replace("\{label\}", "([^ ]+)")
        match = re.match(ins_temp, line)
        if match is not None:
            # Instructions with labels are 3 bytes
            offset += 3
            return [translation[instruction], *match.groups()]

        ins_temp = match_whole_ins.replace(
            "\{number\}", "(?:(0x([0-9a-fA-F]+))|(0b([01]+))|([0-9]+))"
        )
        match = re.match(ins_temp, line)
        if match is not None:
            # Instructions with numbers are 2 bytes
            offset += 2

            # TODO: Only supports one number per instruction
            if match.group(1):
                number = int(match.group(2), 16)
            elif match.group(3):
                number = int(match.group(4), 2)
            elif match.group(5):
                number = int(match.group(5))

            if number > 0xFF:
                print(line)
                print("Number larger than can fit in register")
                return None

            return [translation[instruction], number]
    return None


def parse(input_file, output_file):
    final = []
    labels = {}
    global offset
    offset = 0

    for ln, line in enumerate(input_file):
        line = re.sub(r"//.*", r"", line)
        line = line.strip()
        if not line:
            continue

        variables = line.split()
        opp = variables[0]
        opp_args = " ".join(variables[1:])

        label_match = re.match(":(.+)", opp)
        if label_match is not None:
            # print(line, offset)
            label_match = label_match.group(1)
            if label_match not in labels:
                labels[label_match] = offset
            else:
                print(line)
                print("Line %d duplicate label detected" % (ln + 1))
        elif opp in operations:
            if not operations[opp](opp_args):
                print(line)
                print("Line %d is not valid" % (ln + 1))
                return

            hex_op = opp_to_hex(line)
            if hex_op is None:
                print(line)
                print("Line %d couldn't find translation for instruction" % (ln + 1))
                return
            final.extend(hex_op)
        else:
            print(line)
            print("Line %d couldn't find matching instruction" % (ln + 1))
            return

    # for x in final:
    #    if isinstance(x, int):
    #        print(hex(int(x)), end=' ')
    #    else:
    #        print(x, end=' ')
    # print()

    # print(final)
    file_output = []
    for ins in final:
        if isinstance(ins, str):
            if ins not in labels:
                print("Label %s has not been defined" % (ins))
                return

            ins = labels[ins]
            file_output.append("%02x" % (ins >> 4 * 2))
            file_output.append("%02x" % (ins & 0xFF))
        else:
            file_output.append("%02x" % ins)
    # print(file_output)

    if output_file is None:
        output_file = open(pathlib.Path(input_file.name).stem + ".o", "w")

    output_file.write("v2.0 raw\n")
    output_file.write(" ".join(file_output))
    output_file.write("\n")
    output_file.close()

    print("Successfully compiled")
    print("File written to %s" % output_file.name)


parser = argparse.ArgumentParser(description="Process some integers.")
parser.add_argument(
    "input",
    type=argparse.FileType("r"),
    help="The assembly file to compile to machine level code",
)
parser.add_argument(
    "--output",
    "-o",
    type=argparse.FileType("w"),
    help="The machine level filename to write",
)
import sys

if len(sys.argv) > 1:
    args = parser.parse_args()
    input_file = args.input
    output_file = args.output
else:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()

    filename = filedialog.askopenfilename()
    input_file = open(filename, "r")
    output_file = None

parse(input_file, output_file)
