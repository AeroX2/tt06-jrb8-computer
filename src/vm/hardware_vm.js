import { MOV_RANGE, CMP_RANGE, JMP_RANGE, JMP2_RANGE, OPP_RANGE, LOAD_RANGE, SAVE_RANGE, IN_OUT_RANGE, CU_FLAGS, } from "../utils/cu_flags";
export class HardwareVM {
    // Registers
    registerA = 0;
    registerB = 0;
    registerC = 0;
    registerD = 0;
    // Memory
    // 256 pages of 256 bytes: hardware addresses RAM as {mpage, mar}
    ram = new Array(65536).fill(0);
    rom = new Array(65536).fill(0); // 16-bit address space
    mar = 0; // Memory Address Register
    ramPage = 0;
    // Flags
    zeroFlag = false;
    overflowFlag = false;
    carryFlag = false;
    signFlag = false;
    carryEnabled = false;
    signedMode = false;
    // Program Counter
    pc = 0;
    outputCallback;
    inputCallback;
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
    loadProgram(program) {
        this.rom = [...program];
        this.pc = 0;
    }
    // Get the loaded program
    getProgram() {
        return [...this.rom];
    }
    // `flagSourceByte` is the 8-bit value the silicon actually latches onto the
    // flag bus (the databus at flag-write time). It defaults to the low byte of
    // `result`, but for output-inverting ALU ops it is the PRE-inversion
    // intermediate (see hardware-errata.md E2), which differs from the final
    // result. Zero/sign are derived from this byte; carry/overflow come from the
    // full (unmasked) arithmetic value.
    updateFlags(result, flagSourceByte = result & 0xff, overflow = false) {
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
    step() {
        const instruction = this.rom[this.pc];
        this.pc++;
        if (instruction === CU_FLAGS["nop"]) {
            return true;
        }
        else if (instruction === CU_FLAGS["halt"]) {
            return false;
        }
        if (instruction >= MOV_RANGE.MIN && instruction <= MOV_RANGE.MAX) {
            this.executeMove(instruction);
        }
        else if (instruction >= CMP_RANGE.MIN && instruction <= CMP_RANGE.MAX) {
            this.executeCompare(instruction);
        }
        else if (instruction >= JMP_RANGE.MIN && instruction <= JMP_RANGE.MAX) {
            this.executeJump(instruction);
        }
        else if (instruction >= JMP2_RANGE.MIN && instruction <= JMP2_RANGE.MAX) {
            this.executeJumpRelative(instruction);
        }
        else if (instruction >= OPP_RANGE.MIN && instruction <= OPP_RANGE.MAX) {
            this.executeALU(instruction);
        }
        else if (instruction >= LOAD_RANGE.MIN && instruction <= LOAD_RANGE.MAX) {
            this.executeLoad(instruction);
        }
        else if (instruction >= SAVE_RANGE.MIN && instruction <= SAVE_RANGE.MAX) {
            this.executeSave(instruction);
        }
        else if (instruction >= IN_OUT_RANGE.MIN && instruction <= IN_OUT_RANGE.MAX) {
            this.executeIO(instruction);
        }
        return true;
    }
    executeMove(instruction) {
        // Get source and destination from instruction mapping
        // For instruction 0xXY:
        // if Y < 4: src = 0 (A), dst = Y
        // if Y < 7: src = 1 (B), dst = Y-3
        // if Y < A: src = 2 (C), dst = Y-6
        // if Y < D: src = 3 (D), dst = Y-9
        const instr = instruction & 0x0f;
        if (instr === 0 || instr > 0x0c)
            return; // NOP or invalid
        const src = Math.floor((instr - 1) / 3);
        const dst = ((instr - 1) % 3) + ((instr - 1) % 3 >= src ? 1 : 0);
        this.setRegisterByIndex(dst, this.getRegisterByIndex(src));
    }
    executeCompare(instruction) {
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
    executeJump(instruction) {
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
            }
            else {
                this.pc += 1;
            }
            return;
        }
        const jumpAddress = (this.rom[this.pc] << 8) | this.rom[this.pc + 1];
        if (this.shouldJump(condition)) {
            this.pc = jumpAddress;
        }
        else {
            this.pc += 2; // Skip address bytes
        }
    }
    executeJumpRelative(instruction) {
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
        }
        else {
            this.pc++; // Skip offset byte
        }
    }
    executeALU(instruction) {
        let result = 0;
        // Control operations
        if (instruction === CU_FLAGS["opp clr"]) {
            // HARDWARE QUIRK (hardware-errata.md E6): `opp clr` is a NO-OP on silicon.
            // Its CU control word is 0 (cu_rom[0x50]=0), so the ALU is never started and
            // the flag latch (cmpo, which needs state==INVERT) never fires; the ALU IDLE
            // snoop handles only carry/sign 0x51-0x54, not 0x50. So flags and carry/sign
            // mode are all left unchanged. Do NOT resetFlags() here.
            return;
        }
        else if (instruction === CU_FLAGS["opp carry off"]) {
            this.carryEnabled = false;
            return;
        }
        else if (instruction === CU_FLAGS["opp carry on"]) {
            this.carryEnabled = true;
            return;
        }
        else if (instruction === CU_FLAGS["opp sign off"]) {
            this.signedMode = false;
            return;
        }
        else if (instruction === CU_FLAGS["opp sign on"]) {
            this.signedMode = true;
            return;
        }
        // Calculate result first
        if (instruction === CU_FLAGS["opp 0"])
            result = 0;
        else if (instruction === CU_FLAGS["opp 1"])
            result = 1;
        else if (instruction === CU_FLAGS["opp -1"])
            result = -1;
        else if (instruction === CU_FLAGS["opp a"])
            result = this.registerA;
        else if (instruction === CU_FLAGS["opp b"])
            result = this.registerB;
        else if (instruction === CU_FLAGS["opp c"])
            result = this.registerC;
        else if (instruction === CU_FLAGS["opp d"])
            result = this.registerD;
        // Unary operations
        else if (instruction === CU_FLAGS["opp ~a"])
            result = ~this.registerA;
        else if (instruction === CU_FLAGS["opp ~b"])
            result = ~this.registerB;
        else if (instruction === CU_FLAGS["opp ~c"])
            result = ~this.registerC;
        else if (instruction === CU_FLAGS["opp ~d"])
            result = ~this.registerD;
        else if (instruction === CU_FLAGS["opp -a"])
            result = -this.registerA;
        else if (instruction === CU_FLAGS["opp -b"])
            result = -this.registerB;
        else if (instruction === CU_FLAGS["opp -c"])
            result = -this.registerC;
        else if (instruction === CU_FLAGS["opp -d"])
            result = -this.registerD;
        else if (instruction === CU_FLAGS["opp a+1"])
            result = this.registerA + 1;
        else if (instruction === CU_FLAGS["opp b+1"])
            result = this.registerB + 1;
        else if (instruction === CU_FLAGS["opp c+1"])
            result = this.registerC + 1;
        else if (instruction === CU_FLAGS["opp d+1"])
            result = this.registerD + 1;
        else if (instruction === CU_FLAGS["opp a-1"])
            result = this.registerA - 1;
        else if (instruction === CU_FLAGS["opp b-1"])
            result = this.registerB - 1;
        else if (instruction === CU_FLAGS["opp c-1"])
            result = this.registerC - 1;
        else if (instruction === CU_FLAGS["opp d-1"])
            result = this.registerD - 1;
        // Binary operations - Addition. Carry (for add-with-carry) is applied
        // centrally below, together with the E3 carry-contamination model.
        else if (instruction >= CU_FLAGS["opp a+b"] && instruction <= CU_FLAGS["opp d+c"]) {
            if (instruction === CU_FLAGS["opp a+b"])
                result = this.registerA + this.registerB;
            else if (instruction === CU_FLAGS["opp a+c"])
                result = this.registerA + this.registerC;
            else if (instruction === CU_FLAGS["opp a+d"])
                result = this.registerA + this.registerD;
            else if (instruction === CU_FLAGS["opp b+a"])
                result = this.registerB + this.registerA;
            else if (instruction === CU_FLAGS["opp b+c"])
                result = this.registerB + this.registerC;
            else if (instruction === CU_FLAGS["opp b+d"])
                result = this.registerB + this.registerD;
            else if (instruction === CU_FLAGS["opp c+a"])
                result = this.registerC + this.registerA;
            else if (instruction === CU_FLAGS["opp c+b"])
                result = this.registerC + this.registerB;
            else if (instruction === CU_FLAGS["opp c+d"])
                result = this.registerC + this.registerD;
            else if (instruction === CU_FLAGS["opp d+a"])
                result = this.registerD + this.registerA;
            else if (instruction === CU_FLAGS["opp d+b"])
                result = this.registerD + this.registerB;
            else if (instruction === CU_FLAGS["opp d+c"])
                result = this.registerD + this.registerC;
        }
        // Binary operations - Subtraction
        else if (instruction === CU_FLAGS["opp a-b"])
            result = this.registerA - this.registerB;
        else if (instruction === CU_FLAGS["opp a-c"])
            result = this.registerA - this.registerC;
        else if (instruction === CU_FLAGS["opp a-d"])
            result = this.registerA - this.registerD;
        else if (instruction === CU_FLAGS["opp b-a"])
            result = this.registerB - this.registerA;
        else if (instruction === CU_FLAGS["opp b-c"])
            result = this.registerB - this.registerC;
        else if (instruction === CU_FLAGS["opp b-d"])
            result = this.registerB - this.registerD;
        else if (instruction === CU_FLAGS["opp c-a"])
            result = this.registerC - this.registerA;
        else if (instruction === CU_FLAGS["opp c-b"])
            result = this.registerC - this.registerB;
        else if (instruction === CU_FLAGS["opp c-d"])
            result = this.registerC - this.registerD;
        else if (instruction === CU_FLAGS["opp d-a"])
            result = this.registerD - this.registerA;
        else if (instruction === CU_FLAGS["opp d-b"])
            result = this.registerD - this.registerB;
        else if (instruction === CU_FLAGS["opp d-c"])
            result = this.registerD - this.registerC;
        // Binary operations - Multiplication (low)
        else if (instruction === CU_FLAGS["opp a*a"])
            result = this.registerA * this.registerA;
        else if (instruction === CU_FLAGS["opp a*b"])
            result = this.registerA * this.registerB;
        else if (instruction === CU_FLAGS["opp a*c"])
            result = this.registerA * this.registerC;
        else if (instruction === CU_FLAGS["opp a*d"])
            result = this.registerA * this.registerD;
        else if (instruction === CU_FLAGS["opp b*a"])
            result = this.registerB * this.registerA;
        else if (instruction === CU_FLAGS["opp b*b"])
            result = this.registerB * this.registerB;
        else if (instruction === CU_FLAGS["opp b*c"])
            result = this.registerB * this.registerC;
        else if (instruction === CU_FLAGS["opp b*d"])
            result = this.registerB * this.registerD;
        else if (instruction === CU_FLAGS["opp c*a"])
            result = this.registerC * this.registerA;
        else if (instruction === CU_FLAGS["opp c*b"])
            result = this.registerC * this.registerB;
        else if (instruction === CU_FLAGS["opp c*c"])
            result = this.registerC * this.registerC;
        else if (instruction === CU_FLAGS["opp c*d"])
            result = this.registerC * this.registerD;
        else if (instruction === CU_FLAGS["opp d*a"])
            result = this.registerD * this.registerA;
        else if (instruction === CU_FLAGS["opp d*b"])
            result = this.registerD * this.registerB;
        else if (instruction === CU_FLAGS["opp d*c"])
            result = this.registerD * this.registerC;
        else if (instruction === CU_FLAGS["opp d*d"])
            result = this.registerD * this.registerD;
        // Binary operations - Division. Silicon guards a zero divisor to 1 (so the
        // result is the dividend, never a trap -- errata A) and divides signed when
        // sign mode is on, truncating toward zero (errata B).
        else if (instruction >= CU_FLAGS["opp a/b"] && instruction <= CU_FLAGS["opp d/c"]) {
            const [x, y] = this.oppTwoOperands(instruction);
            result = this.divide(x, y);
        }
        // Binary operations - Logical AND
        else if (instruction === CU_FLAGS["opp a&b"])
            result = this.registerA & this.registerB;
        else if (instruction === CU_FLAGS["opp a&c"])
            result = this.registerA & this.registerC;
        else if (instruction === CU_FLAGS["opp a&d"])
            result = this.registerA & this.registerD;
        else if (instruction === CU_FLAGS["opp b&c"])
            result = this.registerB & this.registerC;
        else if (instruction === CU_FLAGS["opp b&d"])
            result = this.registerB & this.registerD;
        else if (instruction === CU_FLAGS["opp c&d"])
            result = this.registerC & this.registerD;
        // Binary operations - Logical OR
        else if (instruction === CU_FLAGS["opp a|b"])
            result = this.registerA | this.registerB;
        else if (instruction === CU_FLAGS["opp a|c"])
            result = this.registerA | this.registerC;
        else if (instruction === CU_FLAGS["opp a|d"])
            result = this.registerA | this.registerD;
        else if (instruction === CU_FLAGS["opp b|c"])
            result = this.registerB | this.registerC;
        else if (instruction === CU_FLAGS["opp b|d"])
            result = this.registerB | this.registerD;
        else if (instruction === CU_FLAGS["opp c|d"])
            result = this.registerC | this.registerD;
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
            }
            else {
                this.carryFlag = false;
            }
            this.overflowFlag = false;
        }
        else if (this.isSumPathOpp(instruction)) {
            // Adder-path op (const/identity/negate/inc/add/sub). Carry may be folded
            // in (E3); overflow is the true signed overflow, latched regardless of
            // sign mode (errata B).
            result += carryIn;
            this.updateFlags(result, result & 0xff, this.addSubOverflow(instruction, carryIn));
        }
        else {
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
    isSumPathOpp(instruction) {
        return instruction >= 0x55 && instruction <= 0x83;
    }
    // ALU ops whose output is bitwise-inverted as the final datapath stage
    // (E2): opp -1, opp ~a..~d, opp a-1..d-1, and the OR group opp a|b..c|d.
    isOutputInverting(instruction) {
        return (instruction === CU_FLAGS["opp -1"] ||
            (instruction >= CU_FLAGS["opp ~a"] && instruction <= CU_FLAGS["opp ~d"]) ||
            (instruction >= CU_FLAGS["opp a-1"] && instruction <= CU_FLAGS["opp d-1"]) ||
            (instruction >= CU_FLAGS["opp a|b"] && instruction <= CU_FLAGS["opp c|d"]));
    }
    // Interpret a byte as a signed 8-bit value (-128..127).
    signed8(value) {
        const b = value & 0xff;
        return b & 0x80 ? b - 256 : b;
    }
    // The two register operands of a binary `opp` (e.g. `a.*b`, `a/b`) as raw bytes.
    oppTwoOperands(instruction) {
        const opStr = Object.entries(CU_FLAGS).find(([, v]) => v === instruction)?.[0] ?? "";
        const m = opStr.match(/^opp ([abcd]).*?([abcd])$/);
        const idx = { a: 0, b: 1, c: 2, d: 3 };
        if (!m)
            return [0, 0];
        return [this.getRegisterByIndex(idx[m[1]]), this.getRegisterByIndex(idx[m[2]])];
    }
    // Divider matching silicon: a zero divisor is forced to 1 (result = dividend,
    // errata A), and division is signed (truncating toward zero) under sign mode.
    divide(x, y) {
        const divisor = (y & 0xff) === 0 ? 1 : y & 0xff;
        if (this.signedMode) {
            return Math.trunc(this.signed8(x) / this.signed8(divisor)) & 0xff;
        }
        return Math.floor((x & 0xff) / divisor) & 0xff;
    }
    // High byte of the product; signed under sign mode (errata B).
    multiplyHigh(x, y) {
        const product = this.signedMode
            ? (this.signed8(x) * this.signed8(y)) & 0xffff
            : (x & 0xff) * (y & 0xff);
        return (product >> 8) & 0xff;
    }
    // True signed overflow of an adder-path add/sub/inc (else false), computed
    // from the SIGNED operand values -- this is what the silicon overflow flag
    // latches on every add/sub, independent of sign mode (errata B).
    addSubOverflow(instruction, carryIn) {
        const opStr = Object.entries(CU_FLAGS).find(([, v]) => v === instruction)?.[0] ?? "";
        const m = opStr.match(/^opp ([abcd])([+-])([abcd1])$/);
        if (!m)
            return false; // identity/const/negate/mult/div/etc: overflow not meaningful
        const idx = { a: 0, b: 1, c: 2, d: 3 };
        const x = this.signed8(this.getRegisterByIndex(idx[m[1]]));
        const y = m[3] === "1" ? 1 : this.signed8(this.getRegisterByIndex(idx[m[3]]));
        const signed = (m[2] === "+" ? x + y : x - y) + carryIn;
        return signed > 127 || signed < -128;
    }
    getALUDestinationRegister(instruction) {
        // On the real hardware the ALU result is written back to the FIRST
        // operand's register: `opp c+1` -> C (CO+CI in rom/cu_flags.csv),
        // `opp b+a` -> B (BO+AO2+BI), `opp a&d` -> A (AO+DO2+AI).
        const opStr = Object.entries(CU_FLAGS).find(([_, value]) => value === instruction)?.[0] ?? "";
        if (!opStr.startsWith("opp "))
            return 0; // Default to A if not found
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
    executeLoad(instruction) {
        let address;
        let value;
        let targetReg;
        if (instruction >= CU_FLAGS["load ram[a] a"] && instruction <= CU_FLAGS["load ram[d] d"]) {
            // Load from RAM using register address
            const addrReg = Math.floor((instruction - CU_FLAGS["load ram[a] a"]) / 4);
            targetReg = (instruction - CU_FLAGS["load ram[a] a"]) % 4;
            const index = this.getRegisterByIndex(addrReg);
            this.mar = index; // HARDWARE QUIRK (errata E7): indexed RAM access clobbers MAR
            address = index | (this.ramPage << 8);
            value = this.ram[address];
            this.setRegisterByIndex(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["load rom a {number}"] &&
            instruction <= CU_FLAGS["load rom d {number}"]) {
            // Load immediate value from ROM
            targetReg = instruction - CU_FLAGS["load rom a {number}"];
            value = this.rom[this.pc++];
            this.setRegisterByIndex(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["load ram[{number}] a"] &&
            instruction <= CU_FLAGS["load ram[{number}] d"]) {
            // Load from RAM using constant address (the page register still applies)
            targetReg = instruction - CU_FLAGS["load ram[{number}] a"];
            const addrByte = this.rom[this.pc++];
            this.mar = addrByte; // HARDWARE QUIRK (errata E7): immediate RAM access clobbers MAR
            address = addrByte | (this.ramPage << 8);
            value = this.ram[address];
            this.setRegisterByIndex(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["set a rampage"] &&
            instruction <= CU_FLAGS["set d rampage"]) {
            // Set RAM page
            const reg = instruction - CU_FLAGS["set a rampage"];
            this.ramPage = this.getRegisterByIndex(reg);
        }
    }
    executeSave(instruction) {
        let address;
        let value;
        let sourceReg;
        if (instruction >= CU_FLAGS["save a mar"] && instruction <= CU_FLAGS["save d mar"]) {
            // Save to MAR
            sourceReg = instruction - CU_FLAGS["save a mar"];
            this.mar = this.getRegisterByIndex(sourceReg);
        }
        else if (instruction >= CU_FLAGS["save a ram[current]"] &&
            instruction <= CU_FLAGS["save d ram[current]"]) {
            // Save to RAM at current MAR
            sourceReg = instruction - CU_FLAGS["save a ram[current]"];
            value = this.getRegisterByIndex(sourceReg);
            this.ram[this.mar | (this.ramPage << 8)] = value;
        }
        else if (instruction >= CU_FLAGS["save a ram[a]"] &&
            instruction <= CU_FLAGS["save d ram[d]"]) {
            // Save to RAM using register address
            sourceReg = instruction - CU_FLAGS["save a ram[a]"];
            const index = this.getRegisterByIndex(sourceReg);
            this.mar = index; // HARDWARE QUIRK (errata E7): indexed RAM access clobbers MAR
            address = index | (this.ramPage << 8);
            value = this.getRegisterByIndex(sourceReg);
            this.ram[address] = value;
        }
        else if (instruction >= CU_FLAGS["save a ram[{number}]"] &&
            instruction <= CU_FLAGS["save d ram[{number}]"]) {
            // Save to RAM using constant address (the page register still applies)
            sourceReg = instruction - CU_FLAGS["save a ram[{number}]"];
            const addrByte = this.rom[this.pc++];
            this.mar = addrByte; // HARDWARE QUIRK (errata E7): immediate RAM access clobbers MAR
            address = addrByte | (this.ramPage << 8);
            value = this.getRegisterByIndex(sourceReg);
            this.ram[address] = value;
        }
    }
    executeIO(instruction) {
        if (instruction >= CU_FLAGS["in a"] && instruction <= CU_FLAGS["in d"]) {
            const targetReg = instruction - CU_FLAGS["in a"];
            const value = this.inputCallback ? this.inputCallback() : 0;
            this.setRegisterValue(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["out a"] && instruction <= CU_FLAGS["out d"]) {
            let value = this.getRegisterValue(instruction - CU_FLAGS["out a"]);
            // Convert to signed only if in signed mode and top bit is set
            if (this.signedMode && value & 0x80)
                value = value - 256;
            if (this.outputCallback) {
                this.outputCallback(value);
            }
        }
        else if (instruction === CU_FLAGS["out {number}"]) {
            // OUT immediate value
            const value = this.rom[this.pc++];
            if (this.outputCallback) {
                this.outputCallback(value);
            }
        }
        else if (instruction === CU_FLAGS["out ram[{number}]"]) {
            // OUT from RAM constant address
            const address = this.rom[this.pc++];
            this.mar = address; // HARDWARE QUIRK (errata E7): immediate RAM access clobbers MAR
            if (this.outputCallback) {
                this.outputCallback(this.ram[address]);
            }
        }
        else if (instruction >= CU_FLAGS["out ram[a]"] && instruction <= CU_FLAGS["out ram[d]"]) {
            // OUT from RAM register address
            const reg = instruction - CU_FLAGS["out ram[a]"];
            const address = this.getRegisterByIndex(reg);
            this.mar = address; // HARDWARE QUIRK (errata E7): indexed RAM access clobbers MAR
            if (this.outputCallback) {
                this.outputCallback(this.ram[address]);
            }
        }
    }
    shouldJump(condition) {
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
    getRegisterByIndex(index) {
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
    setRegisterByIndex(index, value) {
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
    getConstantForCmp(type) {
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
    getRegisterValue(index) {
        return this.getRegisterByIndex(index);
    }
    setRegisterValue(index, value) {
        this.setRegisterByIndex(index, value);
    }
    setOutputCallback(callback) {
        this.outputCallback = callback;
    }
    setInputCallback(callback) {
        this.inputCallback = callback;
    }
    // Debug methods
    getRegisterA() {
        return this.registerA;
    }
    getRegisterB() {
        return this.registerB;
    }
    getRegisterC() {
        return this.registerC;
    }
    getRegisterD() {
        return this.registerD;
    }
    getRam() {
        return this.ram;
    }
    getProgramCounter() {
        return this.pc;
    }
    getCurrentInstruction() {
        return this.rom[this.pc];
    }
    getFlags() {
        return {
            z: this.zeroFlag,
            o: this.overflowFlag,
            c: this.carryFlag,
            s: this.signFlag,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfdm0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdm0vaGFyZHdhcmVfdm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLFNBQVMsRUFDVCxTQUFTLEVBQ1QsU0FBUyxFQUNULFVBQVUsRUFDVixTQUFTLEVBQ1QsVUFBVSxFQUNWLFVBQVUsRUFDVixZQUFZLEVBQ1osUUFBUSxHQUNULE1BQU0sbUJBQW1CLENBQUM7QUFFM0IsTUFBTSxPQUFPLFVBQVU7SUFDckIsWUFBWTtJQUNKLFNBQVMsR0FBVyxDQUFDLENBQUM7SUFDdEIsU0FBUyxHQUFXLENBQUMsQ0FBQztJQUN0QixTQUFTLEdBQVcsQ0FBQyxDQUFDO0lBQ3RCLFNBQVMsR0FBVyxDQUFDLENBQUM7SUFFOUIsU0FBUztJQUNULGlFQUFpRTtJQUN6RCxHQUFHLEdBQWEsSUFBSSxLQUFLLENBQVMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pELEdBQUcsR0FBYSxJQUFJLEtBQUssQ0FBUyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUI7SUFDakUsR0FBRyxHQUFXLENBQUMsQ0FBQyxDQUFDLDBCQUEwQjtJQUMzQyxPQUFPLEdBQVcsQ0FBQyxDQUFDO0lBRTVCLFFBQVE7SUFDQSxRQUFRLEdBQVksS0FBSyxDQUFDO0lBQzFCLFlBQVksR0FBWSxLQUFLLENBQUM7SUFDOUIsU0FBUyxHQUFZLEtBQUssQ0FBQztJQUMzQixRQUFRLEdBQVksS0FBSyxDQUFDO0lBQzFCLFlBQVksR0FBWSxLQUFLLENBQUM7SUFDOUIsVUFBVSxHQUFZLEtBQUssQ0FBQztJQUVwQyxrQkFBa0I7SUFDVixFQUFFLEdBQVcsQ0FBQyxDQUFDO0lBRWYsY0FBYyxDQUEyQjtJQUN6QyxhQUFhLENBQWdCO0lBRXJDO1FBQ0UsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2YsQ0FB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QUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzthQUNyRSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2FBQ3JFLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7YUFDckUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzthQUNyRSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2FBQ3JFLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7YUFDckUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztRQUMxRSxzRUFBc0U7UUFDdEUsbUVBQW1FO2FBQzlELElBQUksV0FBVyxJQUFJLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxXQUFXLElBQUksUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2lCQUM3RSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7aUJBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztpQkFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2lCQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7aUJBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztpQkFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2lCQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7aUJBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztpQkFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2lCQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7aUJBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN6RixDQUFDO1FBRUQsa0NBQWtDO2FBQzdCLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3ZGLDJDQUEyQzthQUN0QyxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMs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