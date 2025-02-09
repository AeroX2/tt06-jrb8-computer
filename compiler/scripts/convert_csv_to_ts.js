import fs from "fs";
import path from "path";
import csv from "csv-parser";

const inputFilePath = path.join("..", "rom", "cu_flags.csv");
const outputFilePath = "./src/utils/cu_flags.ts";

const translation = {};
const instructionTypes = new Map([
  ["MOV", { min: 0x00, max: 0x0F }],
  ["CMP", { min: 0x10, max: 0x2F }],
  ["JMP", { min: 0x30, max: 0x3F }],
  ["JMP2", { min: 0x40, max: 0x4F }],
  ["OPP", { min: 0x50, max: 0xBF }],
  ["LOAD", { min: 0xC0, max: 0xDB }],
  ["SAVE", { min: 0xE0, max: 0xEF }],
  ["IN/OUT", { min: 0xF0, max: 0xFE }],
  ["HALT", { min: 0xFF, max: 0xFF }]
]);

fs.createReadStream(inputFilePath)
  .pipe(csv())
  .on("headers", (headers) => {
    const assemblerColumnIndex = headers.indexOf("ASSEMBLER INST");
    if (assemblerColumnIndex === -1) {
      throw new Error("ASSEMBLER INST column not found");
    }
  })
  .on("data", (row) => {
    const assemblerInst = row["ASSEMBLER INST"];
    const instructionId = row[""];  // First unnamed column is the instruction type
    if (assemblerInst && instructionId) {
      // Extract hex value from instruction ID (e.g., "MOV-0x1" -> 0x1)
      const match = instructionId.match(/-0x([0-9a-fA-F]+)/);
      if (match) {
        const value = parseInt(match[1], 16);
        translation[assemblerInst] = value;
      } else if (assemblerInst === "nop") {
        translation[assemblerInst] = 0x00;
      } else if (assemblerInst === "halt") {
        translation[assemblerInst] = 0xFF;
      }
    }
  })
  .on("end", () => {
    // Generate instruction type ranges
    let output = "// Instruction type ranges\n";
    for (const [type, range] of instructionTypes) {
      output += `export const ${type.replace("/", "_")}_RANGE = { MIN: 0x${range.min.toString(16).padStart(2, '0')}, MAX: 0x${range.max.toString(16).padStart(2, '0')} };\n`;
    }
    output += "\n";

    output += "// Instruction lookup table\n";
    output += `export const CU_FLAGS: Record<string, number> = {\n` +
      Object.entries(translation)
        .map(([key, value]) => `  "${key}": 0x${value.toString(16).padStart(2, '0')}`)
        .join(",\n") +
      "\n};\n";

    fs.writeFileSync(outputFilePath, output, "utf-8");
    console.log("cu_flags.ts generated successfully.");
  });
