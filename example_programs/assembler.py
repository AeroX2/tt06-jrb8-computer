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
    "cmp": re.compile(r"([abcd]) ([abcd]|0|1|-1|255)").match,
    "jmp": re.compile(r"(\.?(<=|<|=|>|>=) [abcd])|(.+)").match,
    "jmpr": re.compile(r"(\.?(<=|<|=|>|>=) [abcd])|(.+)").match,
    "opp": re.compile(r"").match,
    "load": check_load,
    "save": check_save,
    "in": re.compile(r"[abcd]").match,
    "out": re.compile(r"[abcd]|[0-9]+|ram\[[0-9]+\]|ram\[[abcd]\]").match,
    "pause": lambda x: x == "",
}

import csv

cu_flags = list(csv.reader(open("../rom/cu_flags.csv", "r")))
assembler_column_ind = cu_flags[0].index("ASSEMBLER INST")
translation = {v[assembler_column_ind]: ind - 1 for ind, v in enumerate(cu_flags)}

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
