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
    "mov a b": 0x1,
    "mov a c": 0x2,
    "mov a d": 0x3,
    "mov b a": 0x4,
    "mov b c": 0x5,
    "mov b d": 0x6,
    "mov c a": 0x7,
    "mov c b": 0x8,
    "mov c d": 0x9,
    "mov d a": 0xA,
    "mov d b": 0xB,
    "mov d c": 0xC,
    "cmp a a": 0x10,
    "cmp a b": 0x11,
    "cmp a c": 0x12,
    "cmp a d": 0x13,
    "cmp b a": 0x14,
    "cmp b b": 0x15,
    "cmp b c": 0x16,
    "cmp b d": 0x17,
    "cmp c a": 0x18,
    "cmp c b": 0x19,
    "cmp c c": 0x1A,
    "cmp c d": 0x1B,
    "cmp d a": 0x1C,
    "cmp d b": 0x1D,
    "cmp d c": 0x1E,
    "cmp d d": 0x1F,
    "jmp {label}": 0x20,
    "jmp = {label}": 0x21,
    "jmp != {label}": 0x22,
    "jmp < {label}": 0x23,
    "jmp <= {label}": 0x24,
    "jmp > {label}": 0x25,
    "jmp >= {label}": 0x26,
    "jmp .< {label}": 0x27,
    "jmp .<= {label}": 0x28,
    "jmp .> {label}": 0x29,
    "jmp .>= {label}": 0x2A,
    "jmpr {number}": 0x30,
    "jmpr = {number}": 0x31,
    "jmpr != {number}": 0x32,
    "jmpr < {number}": 0x33,
    "jmpr <= {number}": 0x34,
    "jmpr > {number}": 0x35,
    "jmpr >= {number}": 0x36,
    "jmpr .< {number}": 0x37,
    "jmpr .<= {number}": 0x38,
    "jmpr .> {number}": 0x39,
    "jmpr .>= {number}": 0x3A,
    "opp clr": 0x40,
    "opp cmp off": 0x41,
    "opp cmp on": 0x42,
    "opp sign off": 0x43,
    "opp sign on": 0x44,
    "opp 0": 0x45,
    "opp 1": 0x46,
    "opp -1": 0x47,
    "opp a": 0x48,
    "opp b": 0x49,
    "opp c": 0x4A,
    "opp d": 0x4B,
    "opp ~a": 0x4C,
    "opp ~b": 0x4D,
    "opp ~c": 0x4E,
    "opp ~d": 0x4F,
    "opp -a": 0x50,
    "opp -b": 0x51,
    "opp -c": 0x52,
    "opp -d": 0x53,
    "opp a+1": 0x54,
    "opp b+1": 0x55,
    "opp c+1": 0x56,
    "opp d+1": 0x57,
    "opp a-1": 0x58,
    "opp b-1": 0x59,
    "opp c-1": 0x5A,
    "opp d-1": 0x5B,
    "opp a+b": 0x5C,
    "opp a+c": 0x5D,
    "opp a+d": 0x5E,
    "opp b+a": 0x5F,
    "opp b+c": 0x60,
    "opp b+d": 0x61,
    "opp c+a": 0x62,
    "opp c+b": 0x63,
    "opp c+d": 0x64,
    "opp d+a": 0x65,
    "opp d+b": 0x66,
    "opp d+c": 0x67,
    "opp a-b": 0x68,
    "opp a-c": 0x69,
    "opp a-d": 0x6A,
    "opp b-a": 0x6B,
    "opp b-c": 0x6C,
    "opp b-d": 0x6D,
    "opp c-a": 0x6E,
    "opp c-b": 0x6F,
    "opp c-d": 0x70,
    "opp d-a": 0x71,
    "opp d-b": 0x72,
    "opp d-c": 0x73,
    "opp a*a": 0x74,
    "opp a*b": 0x75,
    "opp a*c": 0x76,
    "opp a*d": 0x77,
    "opp b*a": 0x78,
    "opp b*b": 0x79,
    "opp b*c": 0x7A,
    "opp b*d": 0x7B,
    "opp c*a": 0x7C,
    "opp c*b": 0x7D,
    "opp c*c": 0x7E,
    "opp c*d": 0x7F,
    "opp d*a": 0x80,
    "opp d*b": 0x81,
    "opp d*c": 0x82,
    "opp d*d": 0x83,
    "opp a.*a": 0x84,
    "opp a.*b": 0x85,
    "opp a.*c": 0x8D,
    "opp c.*c": 0x8E,
    "opp c.*d": 0x8F,
    "opp d.*a": 0x90,
    "opp d.*b": 0x91,
    "opp d.*c": 0x92,
    "opp d.*d": 0x93,
    "opp a/b": 0x94,
    "opp a/c": 0x95,
    "opp a/d": 0x96,
    "opp b/a": 0x97,
    "opp b/c": 0x98,
    "opp b/d": 0x99,
    "opp c/a": 0x9A,
    "opp c/b": 0x9B,
    "opp c/d": 0x9C,
    "opp d/a": 0x9D,
    "opp d/b": 0x9E,
    "opp d/c": 0x9F,
    "opp a&b": 0xA0,
    "opp a&c": 0xA1,
    "opp a&d": 0xA2,
    "opp b&c": 0xA3,
    "opp b&d": 0xA4,
    "opp c&d": 0xA5,
    "opp a|b": 0xA6,
    "opp a|c": 0xA7,
    "opp a|d": 0xA8,
    "opp b|c": 0xA9,
    "opp b|d": 0xAA,
    "opp c|d": 0xAB,
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
