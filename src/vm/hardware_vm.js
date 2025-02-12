import { MOV_RANGE, CMP_RANGE, JMP_RANGE, JMP2_RANGE, OPP_RANGE, LOAD_RANGE, SAVE_RANGE, IN_OUT_RANGE, CU_FLAGS } from '../utils/cu_flags';
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
        this.zeroFlag = (result === 0);
        this.signFlag = ((result & 0x80) !== 0);
        this.carryFlag = (result > 255 || result < 0);
        if (this.signedMode) {
            this.overflowFlag = (result > 127 || result < -128);
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
        const instr = instruction & 0x0F;
        if (instr === 0 || instr > 0x0C)
            return; // NOP or invalid
        const src = Math.floor((instr - 1) / 3);
        const dst = ((instr - 1) % 3) + (((instr - 1) % 3) >= src ? 1 : 0);
        this.setRegisterByIndex(dst, this.getRegisterByIndex(src));
    }
    executeCompare(instruction) {
        let value1, value2;
        if (instruction <= CMP_RANGE.MIN + 0x0F) {
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
        const condition = instruction & 0x0F;
        const jumpAddress = (this.rom[this.pc] << 8) | this.rom[this.pc + 1];
        if (this.shouldJump(condition)) {
            this.pc = jumpAddress;
        }
        else {
            this.pc += 2; // Skip address bytes
        }
    }
    executeJumpRelative(instruction) {
        const condition = instruction & 0x0F;
        const offset = this.rom[this.pc]; // Get 8-bit offset
        // Convert to signed offset (-128 to +127)
        const signedOffset = offset & 0x80 ? (offset - 256) : offset;
        if (this.shouldJump(condition)) {
            this.pc = (this.pc + signedOffset + 1) & 0xFF; // +1 to skip the offset byte
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
            const carryValue = (this.carryEnabled && this.carryFlag) ? 1 : 0;
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
        this.setRegisterByIndex(destReg, result & 0xFF);
    }
    getALUDestinationRegister(instruction) {
        // Extract the first operand from the operation name
        // For example: "a+b" -> a, "b-c" -> b, etc.
        const opStr = Object.entries(CU_FLAGS).find(([_, value]) => value === instruction)?.[0] || "";
        if (!opStr.startsWith("opp "))
            return 0; // Default to A if not found
        const firstOperand = opStr.charAt(4); // Get first character after "opp "
        switch (firstOperand) {
            case 'a': return 0; // A register
            case 'b': return 1; // B register
            case 'c': return 2; // C register
            case 'd': return 3; // D register
            default: return 0; // Default to A register
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
            value = this.ram[address & 0xFF];
            this.setRegisterByIndex(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["load rom a {number}"] && instruction <= CU_FLAGS["load rom d {number}"]) {
            // Load immediate value from ROM
            targetReg = instruction - CU_FLAGS["load rom a {number}"];
            value = this.rom[this.pc++];
            this.setRegisterByIndex(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["load ram[{number}] a"] && instruction <= CU_FLAGS["load ram[{number}] d"]) {
            // Load from RAM using constant address
            targetReg = instruction - CU_FLAGS["load ram[{number}] a"];
            address = this.rom[this.pc++];
            value = this.ram[address];
            this.setRegisterByIndex(targetReg, value);
        }
        else if (instruction >= CU_FLAGS["set a rampage"] && instruction <= CU_FLAGS["set d rampage"]) {
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
        else if (instruction >= CU_FLAGS["save a ram[current]"] && instruction <= CU_FLAGS["save d ram[current]"]) {
            // Save to RAM at current MAR
            sourceReg = instruction - CU_FLAGS["save a ram[current]"];
            value = this.getRegisterByIndex(sourceReg);
            this.ram[this.mar] = value;
        }
        else if (instruction >= CU_FLAGS["save a ram[a]"] && instruction <= CU_FLAGS["save d ram[d]"]) {
            // Save to RAM using register address
            sourceReg = instruction - CU_FLAGS["save a ram[a]"];
            address = this.getRegisterByIndex(sourceReg);
            value = this.getRegisterByIndex(sourceReg);
            this.ram[address] = value;
        }
        else if (instruction >= CU_FLAGS["save a ram[{number}]"] && instruction <= CU_FLAGS["save d ram[{number}]"]) {
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
            if (this.signedMode && (value & 0x80))
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
            case 0x0: return true; // Unconditional
            case 0x1: return this.zeroFlag; // Equal
            case 0x2: return !this.zeroFlag; // Not Equal
            case 0x3: return this.carryFlag; // Less Than (unsigned)
            case 0x4: return this.carryFlag || this.zeroFlag; // Less Equal (unsigned)
            case 0x5: return !this.carryFlag && !this.zeroFlag; // Greater Than (unsigned)
            case 0x6: return !this.carryFlag; // Greater Equal (unsigned)
            case 0x7: return (this.signFlag !== this.overflowFlag); // Less Than (signed)
            case 0x8: return (this.signFlag !== this.overflowFlag) || this.zeroFlag; // Less Equal (signed)
            case 0x9: return (this.signFlag === this.overflowFlag) && !this.zeroFlag; // Greater Than (signed)
            case 0xA: return (this.signFlag === this.overflowFlag); // Greater Equal (signed)
            case 0xB: return this.zeroFlag; // Zero flag set
            case 0xC: return this.overflowFlag; // Overflow flag set
            case 0xD: return this.carryFlag; // Carry flag set
            case 0xE: return this.signFlag; // Sign flag set
            default: return false;
        }
    }
    getRegisterByIndex(index) {
        switch (index) {
            case 0: return this.registerA;
            case 1: return this.registerB;
            case 2: return this.registerC;
            case 3: return this.registerD;
            default: return 0;
        }
    }
    setRegisterByIndex(index, value) {
        value &= 0xFF; // Ensure 8-bit value
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
            case 0: return 0; // Compare with 0
            case 1: return 1; // Compare with 1
            case 2: return -1; // Compare with -1
            case 3: return 255; // Compare with 255
            default: return 0;
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
    getRegisterA() { return this.registerA; }
    getRegisterB() { return this.registerB; }
    getRegisterC() { return this.registerC; }
    getRegisterD() { return this.registerD; }
    getRam() { return this.ram; }
    getProgramCounter() { return this.pc; }
    getCurrentInstruction() { return this.rom[this.pc]; }
    getFlags() {
        return {
            z: this.zeroFlag,
            o: this.overflowFlag,
            c: this.carryFlag,
            s: this.signFlag
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFyZHdhcmVfdm0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvdm0vaGFyZHdhcmVfdm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQWMsUUFBUSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFdkosTUFBTSxPQUFPLFVBQVU7SUFDckIsWUFBWTtJQUNKLFNBQVMsR0FBVyxDQUFDLENBQUM7SUFDdEIsU0FBUyxHQUFXLENBQUMsQ0FBQztJQUN0QixTQUFTLEdBQVcsQ0FBQyxDQUFDO0lBQ3RCLFNBQVMsR0FBVyxDQUFDLENBQUM7SUFFOUIsU0FBUztJQUNELEdBQUcsR0FBYSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDL0MsR0FBRyxHQUFhLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLHVCQUF1QjtJQUN6RCxHQUFHLEdBQVcsQ0FBQyxDQUFDLENBQUUsMEJBQTBCO0lBQzVDLE9BQU8sR0FBVyxDQUFDLENBQUM7SUFFNUIsUUFBUTtJQUNBLFFBQVEsR0FBWSxLQUFLLENBQUM7SUFDMUIsWUFBWSxHQUFZLEtBQUssQ0FBQztJQUM5QixTQUFTLEdBQVksS0FBSyxDQUFDO0lBQzNCLFFBQVEsR0FBWSxLQUFLLENBQUM7SUFDMUIsWUFBWSxHQUFZLEtBQUssQ0FBQztJQUM5QixVQUFVLEdBQVksS0FBSyxDQUFDO0lBRXBDLGtCQUFrQjtJQUNWLEVBQUUsR0FBVyxDQUFDLENBQUM7SUFFZixjQUFjLENBQTJCO0lBQ3pDLGFBQWEsQ0FBZ0I7SUFFckM7UUFDRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDZixDQUFDO0lBRUQsS0FBSztR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U0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pFLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7aUJBQy9GLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7Z0JBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUM7UUFDdEcsQ0FBQztRQUVELGtDQUFrQzthQUM3QixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUV2RiwyQ0FBMkM7YUFDdEMsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFFdkYsK0JBQStCO2FBQzFCLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUM5RixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDOUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzlGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUM5RixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDOUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzlGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUM5RixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDOUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQzlGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzthQUM5RixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDOUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRW5HLGtDQUFrQzthQUM3QixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzthQUNsRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsU0FBUyxDQUFDO1lBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUV2RixpQ0FBaUM7YUFDNUIsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbEYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUFFLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFFdkYseURBQXlEO2FBQ3BELElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzFGLElBQUksV0FBVyxLQUFLLFFBQVEsQ0FBQyxVQUFVLENBQUM7WUFBRSxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUYsSUFBSSxXQUFXLEtBQUssUUFBUSxDQUFDLFVBQVUsQ0FBQztZQUFFLE1BQU0sR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxRixJQUFJLFdBQVcsS0FBSyxRQUFRLENBQUMsVUFBVSxDQUFDO1lBQUUsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FB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