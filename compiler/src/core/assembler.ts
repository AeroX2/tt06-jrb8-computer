import { CU_FLAGS } from '../utils/cu_flags';

export enum HexOrLabelKind {
  HEX,
  LABEL
}

export type HexOrLabel = 
  | { kind: HexOrLabelKind.HEX; hex: number }
  | { kind: HexOrLabelKind.LABEL; label: string };

export class AssemblerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssemblerError';
  }
}

// Regex patterns as constants
const REGISTER = /[abcd]/;
const REGISTER_PAIR = /([abcd]) ([abcd])/;
const NUMBER = /((0x[0-9a-fA-F]+)|(0b[01]+)|(0o[0-9]+)|([0-9]+))/;
const RAM_REGISTER = /ram\[[abcd]\] [abcd]/;
const RAM_NUMBER = /ram\[[0-9]+\] [abcd]/;
const ROM_LOAD = /rom [abcd] [0-9]+/;
const RAM_SAVE = /[abcd] ram/;
const RAM_REGISTER_SAVE = /[abcd] ram\[[abcd]\]/;
const RAM_NUMBER_SAVE = /[abcd] ram\[[0-9]+\]/;
const MAR_SAVE = /[abcd] mar/;
const COMPARE = /([abcd]) ([abcd]|0|1|-1|255)/;
const JUMP = /(\.?(<=|<|=|>|>=) [abcd])|(.+)/;
const OUT_PATTERN = /[abcd]|[0-9]+|ram\[[0-9]+\]|ram\[[abcd]\]/;

export class Assembler {
  private final: HexOrLabel[] = [];
  private labels = new Map<string, number>();
  private offset = { value: 0 };

  // Helper functions for instruction checking
  private checkMov(args: string): boolean {
    const r = args.match(REGISTER_PAIR);
    return r !== null && r[1] !== r[2];
  }

  private checkLoad(args: string): boolean {
    if (args.match(RAM_REGISTER)) return true;
    if (args.match(RAM_NUMBER)) return true;
    return args.match(ROM_LOAD) !== null;
  }

  private checkSave(args: string): boolean {
    if (args.match(RAM_SAVE)) return true;
    if (args.match(RAM_REGISTER_SAVE)) return true;
    if (args.match(RAM_NUMBER_SAVE)) return true;
    return args.match(MAR_SAVE) !== null;
  }

  // Define operations map with proper type
  private operations: Record<string, (x: string) => boolean> = {
    "nop": (x: string) => x === "",
    "mov": (x: string) => this.checkMov(x),
    "cmp": (x: string) => x.match(COMPARE) !== null,
    "jmp": (x: string) => x.match(JUMP) !== null,
    "jmpr": (x: string) => x.match(JUMP) !== null,
    "opp": (x: string) => true,
    "load": (x: string) => this.checkLoad(x),
    "save": (x: string) => this.checkSave(x),
    "in": (x: string) => x.match(REGISTER) !== null,
    "out": (x: string) => x.match(OUT_PATTERN) !== null,
    "halt": (x: string) => x === "",
  } as const;

  // Get translation stage two instructions (those with {label} or {number})
  private translationKeys = Object.keys(CU_FLAGS);
  private translationStageTwo = this.translationKeys.filter(key => 
    key.includes('{label}') || key.includes('{number}')
  );

  private matchLabelInstruction(line: string, instruction: string): HexOrLabel[] | null {
    const escapedInstruction = this.escapeRegExp(instruction);
    const matchWholeIns = `^${escapedInstruction.replace(/\\{label\\}/, "([^ ]+)")}$`;
    const match = line.match(new RegExp(matchWholeIns));
    
    if (match) {
      return [
        { kind: HexOrLabelKind.HEX, hex: CU_FLAGS[instruction] },
        { kind: HexOrLabelKind.LABEL, label: match[1] },
      ];
    }
    return null;
  }

  private matchNumberInstruction(line: string, instruction: string): HexOrLabel[] | null {
    const escapedInstruction = this.escapeRegExp(instruction);
    const matchWholeIns = `^${escapedInstruction.replace(/\\{number\\}/, NUMBER.source)}$`;
    const match = line.match(new RegExp(matchWholeIns));
    
    if (match) {
      let num: number;
      if (match[2]) { // hex
        num = parseInt(match[2], 16);
      } else if (match[3]) { // binary
        num = parseInt(match[3].substring(2), 2);
      } else if (match[4]) { // octal
        num = parseInt(match[4].substring(2), 8);
      } else { // decimal
        num = parseInt(match[5]);
      }

      if (!this.validateHex(num)) {
        throw new AssemblerError("Number larger than can fit in register");
      }

      return [
        { kind: HexOrLabelKind.HEX, hex: CU_FLAGS[instruction] },
        { kind: HexOrLabelKind.HEX, hex: num },
      ];
    }
    return null;
  }

  private oppToHex(line: string, offset: { value: number }): HexOrLabel[] {
    if (line in CU_FLAGS) {
      offset.value++;
      return [{ kind: HexOrLabelKind.HEX, hex: CU_FLAGS[line] }];
    }

    for (const instruction of this.translationStageTwo) {
      let result: HexOrLabel[] | null;
      
      if (instruction.includes('{label}')) {
        result = this.matchLabelInstruction(line, instruction);
      } else {
        result = this.matchNumberInstruction(line, instruction);
      }

      if (result) {
        offset.value += instruction.includes('{label}') ? 3 : 2;
        return result;
      }
    }
    return [];
  }

  private handleLabels(line: string, labels: Map<string, number>, offset: number): boolean {
    const labelMatch = line.match(/:(.+)/);
    if (labelMatch) {
      const label = labelMatch[1].trim();
      if (labels.has(label)) {
        console.error(`Duplicate label detected: ${label}`);
        return false;
      }
      labels.set(label, offset);
      return true;
    }
    return false;
  }

  private translateInstructions(line: string): boolean {
    const variables = line.split(' ');
    const opp = variables[0];
    const oppArgs = variables.slice(1).join(' ');

    if (opp in this.operations) {
      if (!this.operations[opp](oppArgs)) {
        console.error(`Invalid operation: ${line}`);
        return false;
      }
      const hexOp = this.oppToHex(line, this.offset);
      if (hexOp.length === 0) {
        console.error(`Could not translate instruction: ${line}`);
        return false;
      }
      this.final.push(...hexOp);
      return true;
    } else {
      console.error(`Unrecognized instruction: ${line}`);
      return false;
    }
  }

  /**
   * Assembles a list of assembly instructions into machine code
   * @param lines Array of assembly instruction strings
   * @returns Array of hex values and labels
   * @throws AssemblerError if assembly fails
   */
  public assemble(lines: string[]): HexOrLabel[] {
    if (!Array.isArray(lines)) {
      throw new AssemblerError('Input must be an array of strings');
    }
    this.final = [];
    this.labels.clear();
    this.offset.value = 0;

    for (let line of lines) {
      line = line.replace(/\/\/.*/, '').trim();
      if (line.length === 0) continue;

      if (this.handleLabels(line, this.labels, this.offset.value)) {
        continue;
      }

      if (!this.translateInstructions(line)) {
        return [];
      }
    }

    return this.final;
  }

  public hexOutput(final: HexOrLabel[]): number[] {
    const fileOutput: number[] = [];
    
    for (const ins of final) {
      if (ins.kind === HexOrLabelKind.LABEL) {
        const labelHex = this.labels.get(ins.label);
        if (labelHex === undefined) {
          console.error(`Undefined label: ${ins.label}`);
          return [];
        }
        fileOutput.push(labelHex >> 8);
        fileOutput.push(labelHex & 0xFF);
      } else {
        fileOutput.push(ins.hex);
      }
    }

    return fileOutput;
  }

  private validateHex(hex: number): boolean {
    return Number.isInteger(hex) && hex >= 0 && hex <= 0xff;
  }

  private escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }
} 