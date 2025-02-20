import { MOV_RANGE, CMP_RANGE, JMP_RANGE, JMP2_RANGE, OPP_RANGE, LOAD_RANGE, SAVE_RANGE, IN_OUT_RANGE, CU_FLAGS, } from "../utils/cu_flags";
export class HardwareVM {
    // Registers
    registerA = 0;
    registerB = 0;
    registerC = 0;
    registerD = 0;
    // Memory
    ram = new Array(256).fill(0);
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
    updateFlags(result) {
        this.zeroFlag = result === 0;
        this.signFlag = (result & 0x80) !== 0;
        this.carryFlag = result > 255 || result < 0;
        if (this.signedMode) {
            this.overflowFlag = result > 127 || result < -128;
        }
        else {
            this.overflowFlag = false;
        }
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
        let value1, value2;
        if (instruction <= CMP_RANGE.MIN + 0x0f) {
            // Compare with constants (0, 1, -1, 255)
            const reg = instruction & 0x03;
            const constType = (instruction >> 2) & 0x03;
            value1 = this.getRegisterByIndex(reg);
            value2 = this.getConstantForCmp(constType);
        }
        else {
            // Compare between registers
            value1 = this.getRegisterByIndex((instruction >> 2) & 0x03);
            value2 = this.getRegisterByIndex(instruction & 0x03);
        }
        const result = value1 - value2;
        this.updateFlags(result);
    }
    executeJump(instruction) {
        const condition = instruction & 0x0f;
        const jumpAddress = (this.rom[this.pc] << 8) | this.rom[this.pc + 1];
        if (this.shouldJump(condition)) {
            this.pc = jumpAddress;
        }
        else {
            this.pc += 2; // Skip address bytes
        }
    }
    executeJumpRelative(instruction) {
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
            this.resetFlags();
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
        // Binary operations - Addition (now with carry handling)
        else if (instruction >= CU_FLAGS["opp a+b"] && instruction <= CU_FLAGS["opp d+c"]) {
            const carryValue = this.carryEnabled && this.carryFlag ? 1 : 0;
            if (instruction === CU_FLAGS["opp a+b"])
                result = this.registerA + this.registerB + carryValue;
            else if (instruction === CU_FLAGS["opp a+c"])
                result = this.registerA + this.registerC + carryValue;
            else if (instruction === CU_FLAGS["opp a+d"])
                result = this.registerA + this.registerD + carryValue;
            else if (instruction === CU_FLAGS["opp b+a"])
                result = this.registerB + this.registerA + carryValue;
            else if (instruction === CU_FLAGS["opp b+c"])
                result = this.registerB + this.registerC + carryValue;
            else if (instruction === CU_FLAGS["opp b+d"])
                result = this.registerB + this.registerD + carryValue;
            else if (instruction === CU_FLAGS["opp c+a"])
                result = this.registerC + this.registerA + carryValue;
            else if (instruction === CU_FLAGS["opp c+b"])
                result = this.registerC + this.registerB + carryValue;
            else if (instruction === CU_FLAGS["opp c+d"])
                result = this.registerC + this.registerD + carryValue;
            else if (instruction === CU_FLAGS["opp d+a"])
                result = this.registerD + this.registerA + carryValue;
            else if (instruction === CU_FLAGS["opp d+b"])
                result = this.registerD + this.registerB + carryValue;
            else if (instruction === CU_FLAGS["opp d+c"])
                result = this.registerD + this.registerC + carryValue;
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
        // Binary operations - Division
        else if (instruction === CU_FLAGS["opp a/b"])
            result = Math.floor(this.registerA / this.registerB);
        else if (instruction === CU_FLAGS["opp a/c"])
            result = Math.floor(this.registerA / this.registerC);
        else if (instruction === CU_FLAGS["opp a/d"])
            result = Math.floor(this.registerA / this.registerD);
        else if (instruction === CU_FLAGS["opp b/a"])
            result = Math.floor(this.registerB / this.registerA);
        else if (instruction === CU_FLAGS["opp b/c"])
            result = Math.floor(this.registerB / this.registerC);
        else if (instruction === CU_FLAGS["opp b/d"])
            result = Math.floor(this.registerB / this.registerD);
        else if (instruction === CU_FLAGS["opp c/a"])
            result = Math.floor(this.registerC / this.registerA);
        else if (instruction === CU_FLAGS["opp c/b"])
            result = Math.floor(this.registerC / this.registerB);
        else if (instruction === CU_FLAGS["opp c/d"])
            result = Math.floor(this.registerC / this.registerD);
        else if (instruction === CU_FLAGS["opp d/a"])
            result = Math.floor(this.registerD / this.registerA);
        else if (instruction === CU_FLAGS["opp d/b"])
            result = Math.floor(this.registerD / this.registerB);
        else if (instruction === CU_FLAGS["opp d/c"])
            result = Math.floor(this.registerD / this.registerC);
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
        // Binary operations - Special multiplication (high bits)
        else if (instruction === CU_FLAGS["opp a.*a"])
            result = (this.registerA * this.registerA) >> 8;
        else if (instruction === CU_FLAGS["opp a.*b"])
            result = (this.registerA * this.registerB) >> 8;
        else if (instruction === CU_FLAGS["opp a.*c"])
            result = (this.registerA * this.registerC) >> 8;
        else if (instruction === CU_FLAGS["opp a.*d"])
            result = (this.registerA * this.registerD) >> 8;
        else if (instruction === CU_FLAGS["opp b.*a"])
            result = (this.registerB * this.registerA) >> 8;
        else if (instruction === CU_FLAGS["opp b.*b"])
            result = (this.registerB * this.registerB) >> 8;
        else if (instruction === CU_FLAGS["opp b.*c"])
            result = (this.registerB * this.registerC) >> 8;
        else if (instruction === CU_FLAGS["opp b.*d"])
            result = (this.registerB * this.registerD) >> 8;
        else if (instruction === CU_FLAGS["opp c.*a"])
            result = (this.registerC * this.registerA) >> 8;
        else if (instruction === CU_FLAGS["opp c.*b"])
            result = (this.registerC * this.registerB) >> 8;
        else if (instruction === CU_FLAGS["opp c.*c"])
            result = (this.registerC * this.registerC) >> 8;
        else if (instruction === CU_FLAGS["opp c.*d"])
            result = (this.registerC * this.registerD) >> 8;
        else if (instruction === CU_FLAGS["opp d.*a"])
            result = (this.registerD * this.registerA) >> 8;
        else if (instruction === CU_FLAGS["opp d.*b"])
            result = (this.registerD * this.registerB) >> 8;
        else if (instruction === CU_FLAGS["opp d.*c"])
            result = (this.registerD * this.registerC) >> 8;
        else if (instruction === CU_FLAGS["opp d.*d"])
            result = (this.registerD * this.registerD) >> 8;
        // Update flags
        this.updateFlags(result);
        // Determine destination register based on operation type
        // For operations like "a+b", result goes to A
        // For operations like "b+a", result goes to B
        // For operations like "c+d", result goes to C
        // For operations like "d+c", result goes to D
        const destReg = this.getALUDestinationRegister(instruction);
        // Then mask to 8 bits for storage
        this.setRegisterByIndex(destReg, result & 0xff);
    }
    getALUDestinationRegister(instruction) {
        // Extract the first operand from the operation name
        // For example: "a+b" -> a, "b-c" -> b, etc.
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
            address = this.getRegisterByIndex(addrReg) + (this.ramPage << 8);
            value = this.ram[address & 0xff];
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
            // Load from RAM using constant address
            targetReg = instruction - CU_FLAGS["load ram[{number}] a"];
            address = this.rom[this.pc++];
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
            this.ram[this.mar] = value;
        }
        else if (instruction >= CU_FLAGS["save a ram[a]"] &&
            instruction <= CU_FLAGS["save d ram[d]"]) {
            // Save to RAM using register address
            sourceReg = instruction - CU_FLAGS["save a ram[a]"];
            address = this.getRegisterByIndex(sourceReg);
            value = this.getRegisterByIndex(sourceReg);
            this.ram[address] = value;
        }
        else if (instruction >= CU_FLAGS["save a ram[{number}]"] &&
            instruction <= CU_FLAGS["save d ram[{number}]"]) {
            // Save to RAM using constant address
            sourceReg = instruction - CU_FLAGS["save a ram[{number}]"];
            address = this.rom[this.pc++];
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
            if (this.outputCallback) {
                this.outputCallback(this.ram[address]);
            }
        }
        else if (instruction >= CU_FLAGS["out ram[a]"] && instruction <= CU_FLAGS["out ram[d]"]) {
            // OUT from RAM register address
            const reg = instruction - CU_FLAGS["out ram[a]"];
            const address = this.getRegisterByIndex(reg);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfdm0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdm0vaGFyZHdhcmVfdm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLFNBQVMsRUFDVCxTQUFTLEVBQ1QsU0FBUyxFQUNULFVBQVUsRUFDVixTQUFTLEVBQ1QsVUFBVSxFQUNWLFVBQVUsRUFDVixZQUFZLEVBQ1osUUFBUSxHQUNULE1BQU0sbUJBQW1CLENBQUM7QUFFM0IsTUFBTSxPQUFPLFVBQVU7SUFDckIsWUFBWTtJQUNKLFNBQVMsR0FBVyxDQUFDLENBQUM7SUFDdEIsU0FBUyxHQUFXLENBQUMsQ0FBQztJQUN0QixTQUFTLEdBQVcsQ0FBQyxDQUFDO0lBQ3RCLFNBQVMsR0FBVyxDQUFDLENBQUM7SUFFOUIsU0FBUztJQUNELEdBQUcsR0FBYSxJQUFJLEtBQUssQ0FBUyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdkQsR0FBRyxHQUFhLElBQUksS0FBSyxDQUFTLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtJQUNqRSxHQUFHLEdBQVcsQ0FBQyxDQUFDLENBQUMsMEJBQTBCO0lBQzNDLE9BQU8sR0FBVyxDQUFDLENBQUM7SUFFNUIsUUFBUTtJQUNBLFFBQVEsR0FBWSxLQUFLLENBQUM7SUFDMUIsWUFBWSxHQUFZLEtBQUssQ0FBQztJQUM5QixTQUFTLEdBQVksS0FBSyxDQUFDO0lBQzNCLFFBQVEsR0FBWSxLQUFLLENBQUM7SUFDMUIsWUFBWSxHQUFZLEtBQUssQ0FBQztJQUM5QixVQUFVLEdBQVksS0FBSyxDQUFDO0lBRXBDLGtCQUFrQjtJQUNWLEVBQUUsR0FBVyxDQUFDLENBQUM7SUFFZixjQUFjLENBQTJCO0lBQ3pDLGFBQWEsQ0FBZ0I7SUFFckM7UUFDRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZixDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ25CLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7UUFDakIsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDWixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDcEIsQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUN0QixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUMxQixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUN0QixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUMxQixJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUMxQixDQUFDO0lBRUQsd0JBQXdCO0lBQ3hCLFdBQVcsQ0FBQyxPQUFpQjtRQUMzQixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNkLENBQUM7SUFFRCx5QkFBeUI7SUFDekIsVUFBVTtRQUNSLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRU8sV0FBVyxDQUFDLE1BQWM7UUFDaEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxRQUFRLEdBQUcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxHQUFHLEdBQUcsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBRTVDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTSxHQUFHLEdBQUcsSUFBSSxNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUM7UUFDcEQsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztRQUM1QixDQUFDO0lBQ0gsQ0FBQztJQUVELDBCQUEwQjtJQUMxQixJQUFJO1FBQ0YsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdEMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBRVYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDcEMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO2FBQU0sSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDNUMsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO1FBRUQsSUFBSSxXQUFXLElBQUksU0FBUyxDQUFDLEdBQUcsSUFBSSxXQUFXLElBQUksU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ2pFLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDaEMsQ0FBQzthQUFNLElBQUksV0FBVyxJQUFJLFNBQVMsQ0FBQyxHQUFHLElBQUksV0FBVyxJQUFJLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN4RSxJQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ25DLENBQUM7YUFBTSxJQUFJLFdBQVcsSUFBSSxTQUFTLENBQUMsR0FBRyxJQUFJLFdBQVcsSUFBSSxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDeEUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNoQyxDQUFDO2FBQU0sSUFBSSxXQUFXLElBQUksVUFBVSxDQUFDLEdBQUcsSUFBSSxXQUFXLElBQUksVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4QyxDQUFDO2FBQU0sSUFBSSxXQUFXLElBQUksU0FBUyxDQUFDLEdBQUcsSUFBSSxXQUFXLElBQUksU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3hFLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDL0IsQ0FBQzthQUFNLElBQUksV0FBVyxJQUFJLFVBQVUsQ0FBQyxHQUFHLElBQUksV0FBVyxJQUFJLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUMxRSxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxJQUFJLFdBQVcsSUFBSSxVQUFVLENBQUMsR0FBRyxJQUFJLFdBQVcsSUFBSSxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDMUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNoQyxDQUFDO2FBQU0sSUFBSSxXQUFXLElBQUksWUFBWSxDQUFDLEdBQUcsSUFBSSxXQUFXLElBQUksWUFBWSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQzlFLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDOUIsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVPLFdBQVcsQ0FBQyxXQUFtQjtRQUNyQyxzREFBc0Q7UUFDdEQsd0JBQXdCO1FBQ3hCLGlDQUFpQztRQUNqQyxtQ0FBbUM7UUFDbkMsbUNBQW1DO1FBQ25DLG1DQUFtQztRQUNuQyxNQUFNLEtBQUssR0FBRyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ2pDLElBQUksS0FBSyxLQUFLLENBQUMsSUFBSSxLQUFLLEdBQUcsSUFBSTtZQUFFLE9BQU8sQ0FBQyxpQkFBaUI7UUFFMUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN4QyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVqRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFTyxjQUFjLENBQUMsV0FBbUI7UUFDeEMsSUFBSSxNQUFjLEVBQUUsTUFBYyxDQUFDO1FBRW5DLElBQUksV0FBVyxJQUFJLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUM7WUFDeEMseUNBQXlDO1lBQ3pDLE1BQU0sR0FBRyxHQUFHLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFDL0IsTUFBTSxTQUFTLEdBQUcsQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQzVDLE1BQU0sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDdEMsTUFBTSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QyxDQUFDO2FBQU0sQ0FBQztZQUNOLDRCQUE0QjtZQUM1QixNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzVELE1BQU0sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQy9CLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0IsQ0FBQztJQUVPLFdBQVcsQ0FBQyxXQUFtQjtRQUNyQyxNQUFNLFNBQVMsR0FBRyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sV0FBVyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRXJFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxFQUFFLEdBQUcsV0FBVyxDQUFDO1FBQ3hCLENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7UUFDckMsQ0FBQztJQUNILENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxXQUFtQjtRQUM3QyxNQUFNLFNBQVMsR0FBRyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsbUJBQW1CO1FBRXJELDBDQUEwQztRQUMxQyxNQUFNLFlBQVksR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFFM0QsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDL0IsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsWUFBWSxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLDZCQUE2QjtRQUM5RSxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQjtRQUNoQyxDQUFDO0lBQ0gsQ0FBQztJQUVPLFVBQVUsQ0FBQyxXQUFtQjtRQUNwQyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFFZixxQkFBcUI7UUFDckIsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDeEMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU87UUFDVCxDQUFDO2FBQU0sSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUM7WUFDckQsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUM7WUFDMUIsT0FBTztRQUNULENBQUM7YUFBTSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztZQUNwRCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztZQUN6QixPQUFPO1FBQ1QsQ0FBQzthQUFNLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1lBQ3BELElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLE9BQU87UUFDVCxDQUFDO2FBQU0sSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7WUFDbkQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDdkIsT0FBTztRQUNULENBQUM7UUFFRCx5QkFBeUI7UUFDekIsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLENBQUM7YUFDN0MsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLENBQUM7YUFDbEQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQzthQUNwRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDL0QsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQy9ELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxPQUFPLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUMvRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsT0FBTyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDcEUsbUJBQW1CO2FBQ2QsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFFBQVEsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDakUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzthQUNyRSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2FBQ3JFLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7YUFDckUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzthQUNyRSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2FBQ3JFLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7YUFDckUsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzthQUNyRSxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQzFFLHlEQUF5RDthQUNwRCxJQUFJLFdBQVcsSUFBSSxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksV0FBVyxJQUFJLFFBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ2xGLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL0QsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFDckMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQ25ELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDO2lCQUNuRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQztpQkFDbkQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQ25ELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDO2lCQUNuRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQztpQkFDbkQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQ25ELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDO2lCQUNuRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQztpQkFDbkQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztnQkFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQ25ELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsVUFBVSxDQUFDO2lCQUNuRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO2dCQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLFVBQVUsQ0FBQztRQUMxRCxDQUFDO1FBRUQsa0NBQWtDO2FBQzdCLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3ZGLDJDQUEyQzthQUN0QyxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN2RiwrQkFBK0I7YUFDMUIsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNsRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDbEQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNsRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDbEQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNsRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDbEQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUMxQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUNsRCxJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFDMUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDdkQsa0NBQWtDO2FBQzdCLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2FBQ2xGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQ3ZGLGlDQUFpQzthQUM1QixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUN2Rix5REFBeUQ7YUFDcEQsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFB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