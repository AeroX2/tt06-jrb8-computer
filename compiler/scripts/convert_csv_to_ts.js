import fs from "fs";
import path from "path";
import csv from "csv-parser";

const inputFilePath = path.join("..", "rom", "cu_flags.csv");
const outputFilePath = "./src/cu_flags.ts";

const translation = {};

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
    if (assemblerInst) {
      translation[assemblerInst] = assemblerInst === "pause" ? 0xff : Object.keys(translation).length;
    }
  })
  .on("end", () => {
    const output = `export const CU_FLAGS: Record<string, number> = {\n` +
      Object.entries(translation)
      .map(([key, value]) => `  "${key}": 0x${value.toString(16)}`)
      .join(",\n") +
    "\n};\n";
    fs.writeFileSync(outputFilePath, output, "utf-8");
    console.log("cu_flags.ts generated successfully.");
  });
