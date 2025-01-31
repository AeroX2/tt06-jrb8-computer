import os
import tables
import streams
import options
import parseopt
import strutils
import sequtils
import strformat

import lexer
import parser

proc parse(inputFile: string, outputFile: string) =
  let inputFileStream = newFileStream(inputFile, fmRead)

  if isNil(inputFileStream):
    echo "Input file is empty. Aborting."
    return

  try:
    let tokens = lexer.tokenize(inputFileStream)
    for token in tokens:
      if (token.value.isSome):
        echo token.token,": ",token.value.get()
      else:
        echo token.token
    
    let ast = parser.parse(tokens)
    echo ast[]
  except ValueError as e:
    echo e.msg

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
