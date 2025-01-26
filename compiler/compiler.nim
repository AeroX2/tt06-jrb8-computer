import os
import tables
import streams
import options
import parseopt
import strutils
import sequtils
import strformat

import lexer

proc parse(inputFile: string, outputFile: string) =
  let inputFileStream = newFileStream(inputFile, fmRead)

  if isNil(inputFileStream):
    echo "Input file is empty. Aborting."
    return

  echo lexer.tokenize(inputFileStream)
  # tokenize()
  # lexize()
  # emitize()

var inputFile: string
var outputFile: string = ""
for kind, key, val in getopt():
  case kind
  of cmdArgument:
    inputFile = key
  of cmdLongOption, cmdShortOption:
    case key
    of "o":
      outputFile = val
  of cmdEnd:
    discard

if outputFile.strip().len == 0:
  outputFile = changeFileExt(inputFile, "o")

parse(inputFile, outputFile)
