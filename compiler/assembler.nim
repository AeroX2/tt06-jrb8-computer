import os
import nre
import tables
import streams
import options
import parseopt
import strutils
import sequtils
import strformat

import cu_flags

type HexOrLabelKind = enum
  HEX
  LABEL

type HexOrLabel = object
  case kind: HexOrLabelKind
  of HEX:
    hex: int
  of LABEL:
    label: string

# Define checks
proc checkMov(args: string): bool =
  let r = args.match(re"([abcd]) ([abcd])")
  r.isSome() and r.get().captures()[0] != r.get().captures()[1]

proc checkLoad(args: string): bool =
  if args.match(re"ram\[[abcd]\] [abcd]").isSome():
    return true
  if args.match(re"ram\[[0-9]+\] [abcd]").isSome():
    return true
  args.match(re"rom [abcd] [0-9]+").isSome()

proc checkSave(args: string): bool =
  if args.match(re"[abcd] ram").isSome():
    return true
  if args.match(re"[abcd] ram\[[abcd]\]").isSome():
    return true
  if args.match(re"[abcd] ram\[[0-9]+\]").isSome():
    return true
  args.match(re"[abcd] mar").isSome()

# Define operations
var operations = {
  "nop": proc(x: string): bool =
    x == "",
  "mov": checkMov,
  "cmp": proc(x: string): bool =
    x.match(re"([abcd]) ([abcd]|0|1|-1|255)").isSome(),
  "jmp": proc(x: string): bool =
    x.match(re"(\.?(<=|<|=|>|>=) [abcd])|(.+)").isSome(),
  "jmpr": proc(x: string): bool =
    x.match(re"(\.?(<=|<|=|>|>=) [abcd])|(.+)").isSome(),
  "opp": proc(x: string): bool =
    x.match(re"").isSome(),
  "load": checkLoad,
  "save": checkSave,
  "in": proc(x: string): bool =
    x.match(re"[abcd]").isSome(),
  "out": proc(x: string): bool =
    x.match(re"[abcd]|[0-9]+|ram\[[0-9]+\]|ram\[[abcd]\]").isSome(),
  "pause": proc(x: string): bool =
    x == "",
}.toTable

let translation = cu_flags.CU_FLAGS
var translationKeys: seq[string] = @[]
for k in translation.keys:
  translationKeys.add(k)
var translationStageTwo =
  filterIt(translationKeys, it.contains(re"\{label\}") or it.contains(re"\{number\}"))

proc matchLabelInstruction(line: string, instruction: string): Option[seq[HexOrLabel]] =
  var matchWholeIns = fmt"^{escapeRe(instruction)}$".replace("\\{label\\}", "([^ ]+)")
  let match = line.match(re(matchWholeIns))
  if match.isSome():
    return some(
      @[
        HexOrLabel(kind: HexOrLabelKind.HEX, hex: translation[instruction]),
        HexOrLabel(kind: HexOrLabelKind.LABEL, label: match.get().captures()[0]),
      ]
    )
  none(seq[HexOrLabel])

proc matchNumberInstruction(
    line: string, instruction: string
): Option[seq[HexOrLabel]] =
  var matchWholeIns = fmt"^{escapeRe(instruction)}$".replace(
    "\\{number\\}", "((0x[0-9a-fA-F]+)|(0b[01]+)|(0o[0-9]+)|([0-9]+))"
  )
  let match = line.match(re(matchWholeIns))
  if match.isSome():
    let captures = toSeq(match.get().captures())
    let num = (
      if (captures[1].isSome()):
        parseHexInt(captures[1].get())
      elif (captures[2].isSome()):
        parseBinInt(captures[2].get())
      elif (captures[3].isSome()):
        parseOctInt(captures[3].get())
      else:
        parseInt(captures[4].get())
    )

    if num > 0xff:
      echo "Number larger than can fit in register"
      return none(seq[HexOrLabel])
    return some(
      @[
        HexOrLabel(kind: HexOrLabelKind.HEX, hex: translation[instruction]),
        HexOrLabel(kind: HexOrLabelKind.HEX, hex: num),
      ]
    )
  none(seq[HexOrLabel])

proc oppToHex(line: string, offset: var int): seq[HexOrLabel] =
  if translation.contains(line):
    offset.inc()
    return @[HexOrLabel(kind: HexOrLabelKind.HEX, hex: translation[line])]

  for instruction in translationStageTwo:
    let r = (
      if instruction.contains("{label}"):
        matchLabelInstruction(line, instruction)
      else:
        matchNumberInstruction(line, instruction)
    )

    if r.isSome():
      offset += (if instruction.contains("{label}"): 3 else: 2)
      return r.get()
  @[]

proc handleLabels(line: string, labels: var Table[string, int], offset: var int): bool =
  let labelMatch = line.match(re":(.+)")
  if labelMatch.isSome():
    let label = labelMatch.get().captures()[0].strip()
    if labels.contains(label):
      echo fmt"Duplicate label detected: {label}"
      return false
    labels[label] = offset
    return true
  return false

proc translateInstructions(
    line: string, offset: var int, final: var seq[HexOrLabel]
): bool =
  let variables = line.split()
  let opp = variables[0]
  let oppArgs = join(variables[1 ..^ 1], " ")

  if opp in operations:
    if not operations[opp](oppArgs):
      echo fmt"Invalid operation: {line}"
      return false
    let hexOp = oppToHex(line, offset)
    if hexOp.len == 0:
      echo fmt"Could not translate instruction: {line}"
      return false
    final.add(hexOp)
    return true
  else:
    echo fmt"Unrecognized instruction: {line}"
    return false

proc writeOutput(
    final: seq[HexOrLabel], labels: Table[string, int], outputFile: string
) =
  let outputFileStream = newFileStream(outputFile, fmWrite)

  var fileOutput: seq[string]
  for ins in final:
    if ins.kind == HexOrLabelKind.LABEL:
      let label = ins.label
      if not labels.contains(label):
        echo fmt"Undefined label: {label}"
        return
      let labelHex = labels[label]
      fileOutput.add fmt"{(labelHex shr 8):02x}"
      fileOutput.add fmt"{(labelHex and 0xFF):02x}"
    else:
      fileOutput.add fmt"{ins.hex:02x}"

  outputFileStream.writeLine("v2.0 raw")
  outputFileStream.writeLine(join(fileOutput, " "))
  echo fmt"Successfully compiled to: {outputFile}"

proc parse(inputFile: string, outputFile: string) =
  var final: seq[HexOrLabel]
  var labels = initTable[string, int]()
  var offset = 0

  let inputFileStream = newFileStream(inputFile, fmRead)

  if isNil(inputFileStream):
    echo "Input file is empty. Aborting."
    return

  var line: string
  while inputFileStream.readLine(line):
    line = line.replace(re("//.*"), "").strip()
    if line.len == 0:
      continue

    if handleLabels(line, labels, offset):
      continue

    if not translateInstructions(line, offset, final):
      return

  writeOutput(final, labels, outputFile)

var inputFiles: seq[string]
var outputFile: string = ""
for kind, key, val in getopt():
  case kind
  of cmdArgument:
    inputFiles.add(key)
  of cmdLongOption, cmdShortOption:
    case key
    of "o":
      outputFile = val
  of cmdEnd:
    discard

for inputFile in inputFiles:
  echo fmt"Processing {inputFile}"
  if outputFile.strip().len == 0 or inputFiles.len > 1:
    outputFile = changeFileExt(inputFile, "o")
  parse(inputFile, outputFile)
