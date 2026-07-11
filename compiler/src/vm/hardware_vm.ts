import {
  MOV_RANGE,
  CMP_RANGE,
  JMP_RANGE,
  JMP2_RANGE,
  OPP_RANGE,
  LOAD_RANGE,
  SAVE_RANGE,
  IN_OUT_RANGE,
  CU_FLAGS,
} from "../utils/cu_flags";

export class HardwareVM {
  // Registers
  private registerA: number = 0;
  private registerB: number = 0;
  private registerC: number = 0;
  private registerD: number = 0;

  // Memory
  // 256 pages of 256 bytes: hardware addresses RAM as {mpage, mar}
  private ram: number[] = new Array<number>(65536).fill(0);
  rom: number[] = new Array<number>(65536).fill(0); // 16-bit address space
  private mar: number = 0; // Memory Address Register
  private ramPage: number = 0;

  // Flags
  private zeroFlag: boolean = false;
  private overflowFlag: boolean = false;
  private carryFlag: boolean = false;
  private signFlag: boolean = false;
  private carryEnabled: boolean = false;
  private signedMode: boolean = false;

  // Program Counter
  private pc: number = 0;

  private outputCallback?: (value: number) => void;
  private inputCallback?: () => number;

  constructor() {
    this.reset();
  }

  reset() {
    this.registerA = 0;
    this.registerB = 0;
    this.registerC = 0;
    this.registerD = 0;
    this.ram.fill(0);
    this.mar = 0;
    this.ramPage = 0;
    this.pc = 0;
    this.resetFlags();
  }

  resetFlags() {
    this.zeroFlag = false;
    this.overflowFlag = false;
    this.carryFlag = false;
    this.signFlag = false;
    this.carryEnabled = false;
    this.signedMode = false;
  }

  // Load program into ROM
  loadProgram(program: number[]) {
    this.rom = [...program];
    this.pc = 0;
  }

  // Get the loaded program
  getProgram(): number[] {
    return [...this.rom];
  }

  // `flagSourceByte` is the 8-bit value the silicon actually latches onto the
  // flag bus (the databus at flag-write time). It defaults to the low byte of
  // `result`, but for output-inverting ALU ops it is the PRE-inversion
  // intermediate (see hardware-errata.md E2), which differs from the final
  // result. Zero/sign are derived from this byte; carry/overflow come from the
  // full (unmasked) arithmetic value.
  private updateFlags(result: number, flagSourceByte: number = result & 0xff, overflow = false) {
    // NOTE: zero uses the masked byte, not `result === 0`: on hardware a sum of
    // exactly 256 (or any nonzero multiple of 256) latches zero because only the
    // low byte reaches the flag bus.
    this.zeroFlag = (flagSourceByte & 0xff) === 0;
    this.signFlag = (flagSourceByte & 0x80) !== 0;
    this.carryFlag = result > 255 || result < 0;
    // Overflow is supplied by the caller. On silicon it is the true signed
    // overflow of the adder, and it is latched on EVERY add/sub regardless of
    // sign mode -- sign mode only switches multiply/divide to signed (errata B).
    this.overflowFlag = overflow;
  }

  // Execute one instruction
  step(): boolean {
    const instruction = this.rom[this.pc];
    this.pc++;

    if (instruction === CU_FLAGS["nop"]) {
      return true;
    } else if (instruction === CU_FLAGS["halt"]) {
      return false;
    }

    if (instruction >= MOV_RANGE.MIN && instruction <= MOV_RANGE.MAX) {
      this.executeMove(instruction);
    } else if (instruction >= CMP_RANGE.MIN && instruction <= CMP_RANGE.MAX) {
      this.executeCompare(instruction);
    } else if (instruction >= JMP_RANGE.MIN && instruction <= JMP_RANGE.MAX) {
      this.executeJump(instruction);
    } else if (instruction >= JMP2_RANGE.MIN && instruction <= JMP2_RANGE.MAX) {
      this.executeJumpRelative(instruction);
    } else if (instruction >= OPP_RANGE.MIN && instruction <= OPP_RANGE.MAX) {
      this.executeALU(instruction);
    } else if (instruction >= LOAD_RANGE.MIN && instruction <= LOAD_RANGE.MAX) {
      this.executeLoad(instruction);
    } else if (instruction >= SAVE_RANGE.MIN && instruction <= SAVE_RANGE.MAX) {
      this.executeSave(instruction);
    } else if (instruction >= IN_OUT_RANGE.MIN && instruction <= IN_OUT_RANGE.MAX) {
      this.executeIO(instruction);
    }

    return true;
  }

  private executeMove(instruction: number) {
    // Get source and destination from instruction mapping
    // For instruction 0xXY:
    // if Y < 4: src = 0 (A), dst = Y
    // if Y < 7: src = 1 (B), dst = Y-3
    // if Y < A: src = 2 (C), dst = Y-6
    // if Y < D: src = 3 (D), dst = Y-9
    const instr = instruction & 0x0f;
    if (instr === 0 || instr > 0x0c) return; // NOP or invalid

    const src = Math.floor((instr - 1) / 3);
    const dst = ((instr - 1) % 3) + ((instr - 1) % 3 >= src ? 1 : 0);

    this.setRegisterByIndex(dst, this.getRegisterByIndex(src));
  }

  private executeCompare(instruction: number) {
    // HARDWARE QUIRK (see docs/hardware-errata.md): `cmp reg, immediate`
    // (0x10-0x1F) does NOT latch the comparison flags - the CMP bit is clear
    // for those opcodes in rom/alu_flags.csv, so cmpo never asserts. Only
    // `cmp reg, reg` (0x20-0x2F) and the `opp` ALU ops update the flags. A
    // conditional jump after `cmp reg, imm` therefore reads the flags left by
    // the most recent flag-setting op, so model cmp-with-constant as a no-op.
    if (instruction <= CMP_RANGE.MIN + 0x0f) {
      return;
    }
    const value1 = this.getRegisterByIndex((instruction >> 2) & 0x03);
    const value2 = this.getRegisterByIndex(instruction & 0x03);
    // HARDWARE QUIRK (hardware-errata.md E3): `cmp reg, reg` is a subtraction on
    // the same adder as `opp`, so when carry mode is enabled the carry flag is
    // folded into the comparison. Two equal registers can therefore compare as
    // "not equal" if a stray carry is set.
    const carryIn = this.carryEnabled && this.carryFlag ? 1 : 0;
    const diff = value1 - value2 + carryIn;
    // Overflow uses the SIGNED operand values (errata B): the silicon latches
    // the true signed overflow of the compare, so signed jumps work with or
    // without sign mode.
    const signedDiff = this.signed8(value1) - this.signed8(value2) + carryIn;
    this.updateFlags(diff, diff & 0xff, signedDiff > 127 || signedDiff < -128);
  }

  private executeJump(instruction: number) {
    const condition = instruction & 0x0f;

    // HARDWARE QUIRK (hardware-errata.md E5): the flag-test jumps
    // `jmp z/o/c/s {number}` (0x3B-0x3E) are 2-byte instructions with ONE operand
    // byte N, but their stage-2 CU word omits PCC, so the datapath duplicates N
    // into BOTH halves of the 16-bit target -> {N,N} (= N*0x0101), not N. Only a
    // *taken* branch is corrupted; fall-through advances PC by 1 (2-byte encoding).
    if (instruction >= CU_FLAGS["jmp z {number}"] && instruction <= CU_FLAGS["jmp s {number}"]) {
      const n = this.rom[this.pc];
      if (this.shouldJump(condition)) {
        this.pc = (n << 8) | n;
      } else {
        this.pc += 1;
      }
      return;
    }

    const jumpAddress = (this.rom[this.pc] << 8) | this.rom[this.pc + 1];
    if (this.shouldJump(condition)) {
      this.pc = jumpAddress;
    } else {
      this.pc += 2; // Skip address bytes
    }
  }

  private executeJumpRelative(instruction: number) {
    // HARDWARE QUIRK (hardware-errata.md E4): on silicon `jmpr` fetches TWO operand
    // bytes (its CU microcode was copied from the absolute jumps), so the 8-bit
    // offset lands in the HIGH byte (x256) and a second byte is consumed. It is
    // fully broken and the assembler now REJECTS `jmpr` (use absolute `jmp`); this
    // 1-byte-offset model is only an approximation kept for raw-bytecode callers.
    const condition = instruction & 0x0f;
    const offset = this.rom[this.pc]; // Get 8-bit offset

    // Convert to signed offset (-128 to +127)
    const signedOffset = offset & 0x80 ? offset - 256 : offset;

    if (this.shouldJump(condition)) {
      this.pc = (this.pc + signedOffset + 1) & 0xff; // +1 to skip the offset byte
    } else {
      this.pc++; // Skip offset byte
    }
  }

  private executeALU(instruction: number) {
    let result = 0;

    // Control operations
    if (instruction === CU_FLAGS["opp clr"]) {
      // HARDWARE QUIRK (hardware-errata.md E6): `opp clr` is a NO-OP on silicon.
      // Its CU control word is 0 (cu_rom[0x50]=0), so the ALU is never started and
      // the flag latch (cmpo, which needs state==INVERT) never fires; the ALU IDLE
      // snoop handles only carry/sign 0x51-0x54, not 0x50. So flags and carry/sign
      // mode are all left unchanged. Do NOT resetFlags() here.
      return;
    } else if (instruction === CU_FLAGS["opp carry off"]) {
      this.carryEnabled = false;
      return;
    } else if (instruction === CU_FLAGS["opp carry on"]) {
      this.carryEnabled = true;
      return;
    } else if (instruction === CU_FLAGS["opp sign off"]) {
      this.signedMode = false;
      return;
    } else if (instruction === CU_FLAGS["opp sign on"]) {
      this.signedMode = true;
      return;
    }

    // Calculate result first
    if (instruction === CU_FLAGS["opp 0"]) result = 0;
    else if (instruction === CU_FLAGS["opp 1"]) result = 1;
    else if (instruction === CU_FLAGS["opp -1"]) result = -1;
    else if (instruction === CU_FLAGS["opp a"]) result = this.registerA;
    else if (instruction === CU_FLAGS["opp b"]) result = this.registerB;
    else if (instruction === CU_FLAGS["opp c"]) result = this.registerC;
    else if (instruction === CU_FLAGS["opp d"]) result = this.registerD;
    // Unary operations
    else if (instruction === CU_FLAGS["opp ~a"]) result = ~this.registerA;
    else if (instruction === CU_FLAGS["opp ~b"]) result = ~this.registerB;
    else if (instruction === CU_FLAGS["opp ~c"]) result = ~this.registerC;
    else if (instruction === CU_FLAGS["opp ~d"]) result = ~this.registerD;
    else if (instruction === CU_FLAGS["opp -a"]) result = -this.registerA;
    else if (instruction === CU_FLAGS["opp -b"]) result = -this.registerB;
    else if (instruction === CU_FLAGS["opp -c"]) result = -this.registerC;
    else if (instruction === CU_FLAGS["opp -d"]) result = -this.registerD;
    else if (instruction === CU_FLAGS["opp a+1"]) result = this.registerA + 1;
    else if (instruction === CU_FLAGS["opp b+1"]) result = this.registerB + 1;
    else if (instruction === CU_FLAGS["opp c+1"]) result = this.registerC + 1;
    else if (instruction === CU_FLAGS["opp d+1"]) result = this.registerD + 1;
    else if (instruction === CU_FLAGS["opp a-1"]) result = this.registerA - 1;
    else if (instruction === CU_FLAGS["opp b-1"]) result = this.registerB - 1;
    else if (instruction === CU_FLAGS["opp c-1"]) result = this.registerC - 1;
    else if (instruction === CU_FLAGS["opp d-1"]) result = this.registerD - 1;
    // Binary operations - Addition. Carry (for add-with-carry) is applied
    // centrally below, together with the E3 carry-contamination model.
    else if (instruction >= CU_FLAGS["opp a+b"] && instruction <= CU_FLAGS["opp d+c"]) {
      if (instruction === CU_FLAGS["opp a+b"]) result = this.registerA + this.registerB;
      else if (instruction === CU_FLAGS["opp a+c"]) result = this.registerA + this.registerC;
      else if (instruction === CU_FLAGS["opp a+d"]) result = this.registerA + this.registerD;
      else if (instruction === CU_FLAGS["opp b+a"]) result = this.registerB + this.registerA;
      else if (instruction === CU_FLAGS["opp b+c"]) result = this.registerB + this.registerC;
      else if (instruction === CU_FLAGS["opp b+d"]) result = this.registerB + this.registerD;
      else if (instruction === CU_FLAGS["opp c+a"]) result = this.registerC + this.registerA;
      else if (instruction === CU_FLAGS["opp c+b"]) result = this.registerC + this.registerB;
      else if (instruction === CU_FLAGS["opp c+d"]) result = this.registerC + this.registerD;
      else if (instruction === CU_FLAGS["opp d+a"]) result = this.registerD + this.registerA;
      else if (instruction === CU_FLAGS["opp d+b"]) result = this.registerD + this.registerB;
      else if (instruction === CU_FLAGS["opp d+c"]) result = this.registerD + this.registerC;
    }

    // Binary operations - Subtraction
    else if (instruction === CU_FLAGS["opp a-b"]) result = this.registerA - this.registerB;
    else if (instruction === CU_FLAGS["opp a-c"]) result = this.registerA - this.registerC;
    else if (instruction === CU_FLAGS["opp a-d"]) result = this.registerA - this.registerD;
    else if (instruction === CU_FLAGS["opp b-a"]) result = this.registerB - this.registerA;
    else if (instruction === CU_FLAGS["opp b-c"]) result = this.registerB - this.registerC;
    else if (instruction === CU_FLAGS["opp b-d"]) result = this.registerB - this.registerD;
    else if (instruction === CU_FLAGS["opp c-a"]) result = this.registerC - this.registerA;
    else if (instruction === CU_FLAGS["opp c-b"]) result = this.registerC - this.registerB;
    else if (instruction === CU_FLAGS["opp c-d"]) result = this.registerC - this.registerD;
    else if (instruction === CU_FLAGS["opp d-a"]) result = this.registerD - this.registerA;
    else if (instruction === CU_FLAGS["opp d-b"]) result = this.registerD - this.registerB;
    else if (instruction === CU_FLAGS["opp d-c"]) result = this.registerD - this.registerC;
    // Binary operations - Multiplication (low)
    else if (instruction === CU_FLAGS["opp a*a"]) result = this.registerA * this.registerA;
    else if (instruction === CU_FLAGS["opp a*b"]) result = this.registerA * this.registerB;
    else if (instruction === CU_FLAGS["opp a*c"]) result = this.registerA * this.registerC;
    else if (instruction === CU_FLAGS["opp a*d"]) result = this.registerA * this.registerD;
    else if (instruction === CU_FLAGS["opp b*a"]) result = this.registerB * this.registerA;
    else if (instruction === CU_FLAGS["opp b*b"]) result = this.registerB * this.registerB;
    else if (instruction === CU_FLAGS["opp b*c"]) result = this.registerB * this.registerC;
    else if (instruction === CU_FLAGS["opp b*d"]) result = this.registerB * this.registerD;
    else if (instruction === CU_FLAGS["opp c*a"]) result = this.registerC * this.registerA;
    else if (instruction === CU_FLAGS["opp c*b"]) result = this.registerC * this.registerB;
    else if (instruction === CU_FLAGS["opp c*c"]) result = this.registerC * this.registerC;
    else if (instruction === CU_FLAGS["opp c*d"]) result = this.registerC * this.registerD;
    else if (instruction === CU_FLAGS["opp d*a"]) result = this.registerD * this.registerA;
    else if (instruction === CU_FLAGS["opp d*b"]) result = this.registerD * this.registerB;
    else if (instruction === CU_FLAGS["opp d*c"]) result = this.registerD * this.registerC;
    else if (instruction === CU_FLAGS["opp d*d"]) result = this.registerD * this.registerD;
    // Binary operations - Division. Silicon guards a zero divisor to 1 (so the
    // result is the dividend, never a trap -- errata A) and divides signed when
    // sign mode is on, truncating toward zero (errata B).
    else if (instruction >= CU_FLAGS["opp a/b"] && instruction <= CU_FLAGS["opp d/c"]) {
      const [x, y] = this.oppTwoOperands(instruction);
      result = this.divide(x, y);
    }
    // Binary operations - Logical AND
    else if (instruction === CU_FLAGS["opp a&b"]) result = this.registerA & this.registerB;
    else if (instruction === CU_FLAGS["opp a&c"]) result = this.registerA & this.registerC;
    else if (instruction === CU_FLAGS["opp a&d"]) result = this.registerA & this.registerD;
    else if (instruction === CU_FLAGS["opp b&c"]) result = this.registerB & this.registerC;
    else if (instruction === CU_FLAGS["opp b&d"]) result = this.registerB & this.registerD;
    else if (instruction === CU_FLAGS["opp c&d"]) result = this.registerC & this.registerD;
    // Binary operations - Logical OR
    else if (instruction === CU_FLAGS["opp a|b"]) result = this.registerA | this.registerB;
    else if (instruction === CU_FLAGS["opp a|c"]) result = this.registerA | this.registerC;
    else if (instruction === CU_FLAGS["opp a|d"]) result = this.registerA | this.registerD;
    else if (instruction === CU_FLAGS["opp b|c"]) result = this.registerB | this.registerC;
    else if (instruction === CU_FLAGS["opp b|d"]) result = this.registerB | this.registerD;
    else if (instruction === CU_FLAGS["opp c|d"]) result = this.registerC | this.registerD;
    // Binary operations - Special multiplication (high bits). Signed under sign
    // mode (errata B): the high byte differs from the unsigned product.
    else if (instruction >= CU_FLAGS["opp a.*a"] && instruction <= CU_FLAGS["opp d.*d"]) {
      const [x, y] = this.oppTwoOperands(instruction);
      result = this.multiplyHigh(x, y);
    }

    // HARDWARE QUIRK (hardware-errata.md E3): the carry flag is folded into the
    // adder for EVERY adder-path op (constants/identity/~/negate/inc/dec/add/sub),
    // not just add-with-carry, whenever carry mode is enabled. mult/div/and/or use
    // other units and are unaffected.
    const carryIn = this.isSumPathOpp(instruction) && this.carryEnabled && this.carryFlag ? 1 : 0;

    // HARDWARE QUIRK (hardware-errata.md E2): output-inverting ops (~x, x-1, -1,
    // x|y) latch Z/S from the PRE-inversion intermediate, and the register only
    // receives the inverted value afterwards. The intermediate byte is the
    // complement of the (un-inverted) result byte; the carry above is injected
    // into that intermediate before inversion, exactly like the silicon.
    if (this.isOutputInverting(instruction)) {
      const intermediate = (~result & 0xff) + carryIn;
      const flagSourceByte = intermediate & 0xff;
      result = ~intermediate & 0xff;
      // Zero/sign describe the intermediate; carry/overflow after an inverting op
      // are hardware don't-cares and are left cleared.
      this.zeroFlag = flagSourceByte === 0;
      this.signFlag = (flagSourceByte & 0x80) !== 0;
      // HARDWARE QUIRK (hardware-errata.md E2 carry facet): the decrements
      // `opp x-1` (0x68-0x6B) latch carry from the internal negate's borrow,
      // which is never re-derived for the inverted output. carryout = !full_sum[8]
      // = !(x==0) = (x != 0) -- the inverse of the true decrement borrow. The other
      // inverting ops (~x, -1, |) clear carry on silicon.
      if (instruction >= CU_FLAGS["opp a-1"] && instruction <= CU_FLAGS["opp d-1"]) {
        const operand = this.getRegisterByIndex(instruction - CU_FLAGS["opp a-1"]);
        this.carryFlag = (operand & 0xff) !== 0;
      } else {
        this.carryFlag = false;
      }
      this.overflowFlag = false;
    } else if (this.isSumPathOpp(instruction)) {
      // Adder-path op (const/identity/negate/inc/add/sub). Carry may be folded
      // in (E3); overflow is the true signed overflow, latched regardless of
      // sign mode (errata B).
      result += carryIn;
      this.updateFlags(result, result & 0xff, this.addSubOverflow(instruction, carryIn));
    } else {
      // mult / div / and: the adder is unused, so silicon clears carry
      // (cselect != 0) and the overflow flag is a don't-care. Zero/sign come
      // from the result byte.
      const resultByte = result & 0xff;
      this.zeroFlag = resultByte === 0;
      this.signFlag = (resultByte & 0x80) !== 0;
      this.carryFlag = false;
      this.overflowFlag = false;
    }

    // Determine destination register based on operation type
    // For operations like "a+b", result goes to A
    // For operations like "b+a", result goes to B
    // For operations like "c+d", result goes to C
    // For operations like "d+c", result goes to D
    const destReg = this.getALUDestinationRegister(instruction);

    // Then mask to 8 bits for storage
    this.setRegisterByIndex(destReg, result & 0xff);
  }

  // Adder-path (cselect==0) ALU ops: constants, identity, bitwise-NOT, negate,
  // increment, decrement, add and subtract (opcodes 0x55-0x83). These are the
  // ops affected by E3 carry contamination. mult/div/and/or use other units.
  private isSumPathOpp(instruction: number): boolean {
    return instruction >= 0x55 && instruction <= 0x83;
  }

  // ALU ops whose output is bitwise-inverted as the final datapath stage
  // (E2): opp -1, opp ~a..~d, opp a-1..d-1, and the OR group opp a|b..c|d.
  private isOutputInverting(instruction: number): boolean {
    return (
      instruction === CU_FLAGS["opp -1"] ||
      (instruction >= CU_FLAGS["opp ~a"] && instruction <= CU_FLAGS["opp ~d"]) ||
      (instruction >= CU_FLAGS["opp a-1"] && instruction <= CU_FLAGS["opp d-1"]) ||
      (instruction >= CU_FLAGS["opp a|b"] && instruction <= CU_FLAGS["opp c|d"])
    );
  }

  // Interpret a byte as a signed 8-bit value (-128..127).
  private signed8(value: number): number {
    const b = value & 0xff;
    return b & 0x80 ? b - 256 : b;
  }

  // The two register operands of a binary `opp` (e.g. `a.*b`, `a/b`) as raw bytes.
  private oppTwoOperands(instruction: number): [number, number] {
    const opStr = Object.entries(CU_FLAGS).find(([, v]) => v === instruction)?.[0] ?? "";
    const m = opStr.match(/^opp ([abcd]).*?([abcd])$/);
    const idx: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
    if (!m) return [0, 0];
    return [this.getRegisterByIndex(idx[m[1]]), this.getRegisterByIndex(idx[m[2]])];
  }

  // Divider matching silicon: a zero divisor is forced to 1 (result = dividend,
  // errata A), and division is signed (truncating toward zero) under sign mode.
  private divide(x: number, y: number): number {
    const divisor = (y & 0xff) === 0 ? 1 : y & 0xff;
    if (this.signedMode) {
      return Math.trunc(this.signed8(x) / this.signed8(divisor)) & 0xff;
    }
    return Math.floor((x & 0xff) / divisor) & 0xff;
  }

  // High byte of the product; signed under sign mode (errata B).
  private multiplyHigh(x: number, y: number): number {
    const product = this.signedMode
      ? (this.signed8(x) * this.signed8(y)) & 0xffff
      : (x & 0xff) * (y & 0xff);
    return (product >> 8) & 0xff;
  }

  // True signed overflow of an adder-path add/sub/inc (else false), computed
  // from the SIGNED operand values -- this is what the silicon overflow flag
  // latches on every add/sub, independent of sign mode (errata B).
  private addSubOverflow(instruction: number, carryIn: number): boolean {
    const opStr = Object.entries(CU_FLAGS).find(([, v]) => v === instruction)?.[0] ?? "";
    const m = opStr.match(/^opp ([abcd])([+-])([abcd1])$/);
    if (!m) return false; // identity/const/negate/mult/div/etc: overflow not meaningful
    const idx: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
    const x = this.signed8(this.getRegisterByIndex(idx[m[1]]));
    const y = m[3] === "1" ? 1 : this.signed8(this.getRegisterByIndex(idx[m[3]]));
    const signed = (m[2] === "+" ? x + y : x - y) + carryIn;
    return signed > 127 || signed < -128;
  }

  private getALUDestinationRegister(instruction: number): number {
    // On the real hardware the ALU result is written back to the FIRST
    // operand's register: `opp c+1` -> C (CO+CI in rom/cu_flags.csv),
    // `opp b+a` -> B (BO+AO2+BI), `opp a&d` -> A (AO+DO2+AI).
    const opStr = Object.entries(CU_FLAGS).find(([_, value]) => value === instruction)?.[0] ?? "";
    if (!opStr.startsWith("opp ")) return 0; // Default to A if not found

    const firstOperand = opStr.charAt(4); // Get first character after "opp "
    switch (firstOperand) {
      case "a":
        return 0; // A register
      case "b":
        return 1; // B register
      case "c":
        return 2; // C register
      case "d":
        return 3; // D register
      default:
        return 0; // Default to A register
    }
  }

  private executeLoad(instruction: number) {
    let address: number;
    let value: number;
    let targetReg: number;

    if (instruction >= CU_FLAGS["load ram[a] a"] && instruction <= CU_FLAGS["load ram[d] d"]) {
      // Load from RAM using register address
      const addrReg = Math.floor((instruction - CU_FLAGS["load ram[a] a"]) / 4);
      targetReg = (instruction - CU_FLAGS["load ram[a] a"]) % 4;
      const index = this.getRegisterByIndex(addrReg);
      this.mar = index; // HARDWARE QUIRK (errata E7): indexed RAM access clobbers MAR
      address = index | (this.ramPage << 8);
      value = this.ram[address];
      this.setRegisterByIndex(targetReg, value);
    } else if (
      instruction >= CU_FLAGS["load rom a {number}"] &&
      instruction <= CU_FLAGS["load rom d {number}"]
    ) {
      // Load immediate value from ROM
      targetReg = instruction - CU_FLAGS["load rom a {number}"];
      value = this.rom[this.pc++];
      this.setRegisterByIndex(targetReg, value);
    } else if (
      instruction >= CU_FLAGS["load ram[{number}] a"] &&
      instruction <= CU_FLAGS["load ram[{number}] d"]
    ) {
      // Load from RAM using constant address (the page register still applies)
      targetReg = instruction - CU_FLAGS["load ram[{number}] a"];
      const addrByte = this.rom[this.pc++];
      this.mar = addrByte; // HARDWARE QUIRK (errata E7): immediate RAM access clobbers MAR
      address = addrByte | (this.ramPage << 8);
      value = this.ram[address];
      this.setRegisterByIndex(targetReg, value);
    } else if (
      instruction >= CU_FLAGS["set a rampage"] &&
      instruction <= CU_FLAGS["set d rampage"]
    ) {
      // Set RAM page
      const reg = instruction - CU_FLAGS["set a rampage"];
      this.ramPage = this.getRegisterByIndex(reg);
    }
  }

  private executeSave(instruction: number) {
    let address: number;
    let value: number;
    let sourceReg: number;

    if (instruction >= CU_FLAGS["save a mar"] && instruction <= CU_FLAGS["save d mar"]) {
      // Save to MAR
      sourceReg = instruction - CU_FLAGS["save a mar"];
      this.mar = this.getRegisterByIndex(sourceReg);
    } else if (
      instruction >= CU_FLAGS["save a ram[current]"] &&
      instruction <= CU_FLAGS["save d ram[current]"]
    ) {
      // Save to RAM at current MAR
      sourceReg = instruction - CU_FLAGS["save a ram[current]"];
      value = this.getRegisterByIndex(sourceReg);
      this.ram[this.mar | (this.ramPage << 8)] = value;
    } else if (
      instruction >= CU_FLAGS["save a ram[a]"] &&
      instruction <= CU_FLAGS["save d ram[d]"]
    ) {
      // Save to RAM using register address
      sourceReg = instruction - CU_FLAGS["save a ram[a]"];
      const index = this.getRegisterByIndex(sourceReg);
      this.mar = index; // HARDWARE QUIRK (errata E7): indexed RAM access clobbers MAR
      address = index | (this.ramPage << 8);
      value = this.getRegisterByIndex(sourceReg);
      this.ram[address] = value;
    } else if (
      instruction >= CU_FLAGS["save a ram[{number}]"] &&
      instruction <= CU_FLAGS["save d ram[{number}]"]
    ) {
      // Save to RAM using constant address (the page register still applies)
      sourceReg = instruction - CU_FLAGS["save a ram[{number}]"];
      const addrByte = this.rom[this.pc++];
      this.mar = addrByte; // HARDWARE QUIRK (errata E7): immediate RAM access clobbers MAR
      address = addrByte | (this.ramPage << 8);
      value = this.getRegisterByIndex(sourceReg);
      this.ram[address] = value;
    }
  }

  private executeIO(instruction: number) {
    if (instruction >= CU_FLAGS["in a"] && instruction <= CU_FLAGS["in d"]) {
      const targetReg = instruction - CU_FLAGS["in a"];
      const value = this.inputCallback ? this.inputCallback() : 0;
      this.setRegisterValue(targetReg, value);
    } else if (instruction >= CU_FLAGS["out a"] && instruction <= CU_FLAGS["out d"]) {
      let value = this.getRegisterValue(instruction - CU_FLAGS["out a"]);
      // Convert to signed only if in signed mode and top bit is set
      if (this.signedMode && value & 0x80) value = value - 256;
      if (this.outputCallback) {
        this.outputCallback(value);
      }
    } else if (instruction === CU_FLAGS["out {number}"]) {
      // OUT immediate value
      const value = this.rom[this.pc++];
      if (this.outputCallback) {
        this.outputCallback(value);
      }
    } else if (instruction === CU_FLAGS["out ram[{number}]"]) {
      // OUT from RAM constant address
      const address = this.rom[this.pc++];
      this.mar = address; // HARDWARE QUIRK (errata E7): immediate RAM access clobbers MAR
      if (this.outputCallback) {
        this.outputCallback(this.ram[address]);
      }
    } else if (instruction >= CU_FLAGS["out ram[a]"] && instruction <= CU_FLAGS["out ram[d]"]) {
      // OUT from RAM register address
      const reg = instruction - CU_FLAGS["out ram[a]"];
      const address = this.getRegisterByIndex(reg);
      this.mar = address; // HARDWARE QUIRK (errata E7): indexed RAM access clobbers MAR
      if (this.outputCallback) {
        this.outputCallback(this.ram[address]);
      }
    }
  }

  private shouldJump(condition: number): boolean {
    switch (condition) {
      case 0x0:
        return true; // Unconditional
      case 0x1:
        return this.zeroFlag; // Equal
      case 0x2:
        return !this.zeroFlag; // Not Equal
      case 0x3:
        return this.carryFlag; // Less Than (unsigned)
      case 0x4:
        return this.carryFlag || this.zeroFlag; // Less Equal (unsigned)
      case 0x5:
        return !this.carryFlag && !this.zeroFlag; // Greater Than (unsigned)
      case 0x6:
        return !this.carryFlag; // Greater Equal (unsigned)
      case 0x7:
        return this.signFlag !== this.overflowFlag; // Less Than (signed)
      case 0x8:
        return this.signFlag !== this.overflowFlag || this.zeroFlag; // Less Equal (signed)
      case 0x9:
        return this.signFlag === this.overflowFlag && !this.zeroFlag; // Greater Than (signed)
      case 0xa:
        return this.signFlag === this.overflowFlag; // Greater Equal (signed)
      case 0xb:
        return this.zeroFlag; // Zero flag set
      case 0xc:
        return this.overflowFlag; // Overflow flag set
      case 0xd:
        return this.carryFlag; // Carry flag set
      case 0xe:
        return this.signFlag; // Sign flag set
      default:
        return false;
    }
  }

  private getRegisterByIndex(index: number): number {
    switch (index) {
      case 0:
        return this.registerA;
      case 1:
        return this.registerB;
      case 2:
        return this.registerC;
      case 3:
        return this.registerD;
      default:
        return 0;
    }
  }

  private setRegisterByIndex(index: number, value: number) {
    value &= 0xff; // Ensure 8-bit value
    switch (index) {
      case 0:
        this.registerA = value;
        break;
      case 1:
        this.registerB = value;
        break;
      case 2:
        this.registerC = value;
        break;
      case 3:
        this.registerD = value;
        break;
    }
  }

  private getConstantForCmp(type: number): number {
    switch (type) {
      case 0:
        return 0; // Compare with 0
      case 1:
        return 1; // Compare with 1
      case 2:
        return -1; // Compare with -1
      case 3:
        return 255; // Compare with 255
      default:
        return 0;
    }
  }

  private getRegisterValue(index: number): number {
    return this.getRegisterByIndex(index);
  }

  private setRegisterValue(index: number, value: number) {
    this.setRegisterByIndex(index, value);
  }

  setOutputCallback(callback: (value: number) => void) {
    this.outputCallback = callback;
  }

  setInputCallback(callback: () => number) {
    this.inputCallback = callback;
  }

  // Debug methods
  getRegisterA(): number {
    return this.registerA;
  }
  getRegisterB(): number {
    return this.registerB;
  }
  getRegisterC(): number {
    return this.registerC;
  }
  getRegisterD(): number {
    return this.registerD;
  }
  getRam(): number[] {
    return this.ram;
  }
  getProgramCounter(): number {
    return this.pc;
  }
  getCurrentInstruction(): number {
    return this.rom[this.pc];
  }
  getFlags(): { z: boolean; o: boolean; c: boolean; s: boolean } {
    return {
      z: this.zeroFlag,
      o: this.overflowFlag,
      c: this.carryFlag,
      s: this.signFlag,
    };
  }
}
