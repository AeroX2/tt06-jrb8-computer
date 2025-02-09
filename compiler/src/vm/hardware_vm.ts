export class HardwareVM {
  // Registers
  private registerA: number = 0;
  private registerB: number = 0;
  private registerC: number = 0;
  private registerD: number = 0;

  // Memory
  private ram: number[] = new Array(256).fill(0);
  rom: number[] = new Array(65536).fill(0); // 16-bit address space
  private mar: number = 0;  // Memory Address Register
  private ramPage: number = 0;

  // Flags
  private zeroFlag: boolean = false;
  private overflowFlag: boolean = false;
  private carryFlag: boolean = false;
  private signFlag: boolean = false;
  private cmpEnabled: boolean = false;
  private signedMode: boolean = false;

  // Program Counter
  private pc: number = 0;

  private outputCallback?: (value: number) => void;

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

  private updateFlags(result: number) {
    if (!this.cmpEnabled) return;

    this.zeroFlag = (result === 0);
    this.signFlag = ((result & 0x80) !== 0);
    
    // For 8-bit arithmetic
    if (result > 255) {
      this.carryFlag = true;
      result &= 0xFF;
    } else if (result < 0) {
      this.carryFlag = true;
      result &= 0xFF;
    } else {
      this.carryFlag = false;
    }

    // Overflow detection for signed arithmetic
    if (this.signedMode) {
      if (result > 127 || result < -128) {
        this.overflowFlag = true;
      } else {
        this.overflowFlag = false;
      }
    }
  }

  // Execute one instruction
  step(): boolean {
    const instruction = this.rom[this.pc];
    this.pc++;

    // Decode and execute instruction
    if (instruction >= 0x01 && instruction <= 0x0C) {
      // MOV instructions
      this.executeMove(instruction);
    } else if (instruction >= 0x0D && instruction <= 0x2C) {
      // CMP instructions
      this.executeCompare(instruction);
    } else if (instruction >= 0x2D && instruction <= 0x37) {
      // JMP instructions
      this.executeJump(instruction);
    } else if (instruction >= 0x38 && instruction <= 0x46) {
      // JMPR instructions
      this.executeJumpRelative(instruction);
    } else if (instruction >= 0x47 && instruction <= 0xB6) {
      // ALU operations
      this.executeALU(instruction);
    } else if (instruction >= 0xB7 && instruction <= 0xCE) {
      // LOAD instructions
      this.executeLoad(instruction);
    } else if (instruction >= 0xCF && instruction <= 0xE2) {
      // SAVE instructions
      this.executeSave(instruction);
    } else if (instruction >= 0xE3 && instruction <= 0xF0) {
      // IN/OUT instructions
      this.executeIO(instruction);
    } else if (instruction === 0xFF) {
      // HALT
      return false;
    }

    return true;
  }

  private executeMove(instruction: number) {
    switch(instruction) {
      case 0x01: this.registerB = this.registerA; break;
      case 0x02: this.registerC = this.registerA; break;
      case 0x03: this.registerD = this.registerA; break;
      case 0x04: this.registerA = this.registerB; break;
      case 0x05: this.registerC = this.registerB; break;
      case 0x06: this.registerD = this.registerB; break;
      case 0x07: this.registerA = this.registerC; break;
      case 0x08: this.registerB = this.registerC; break;
      case 0x09: this.registerD = this.registerC; break;
      case 0x0A: this.registerA = this.registerD; break;
      case 0x0B: this.registerB = this.registerD; break;
      case 0x0C: this.registerC = this.registerD; break;
    }
  }

  private executeCompare(instruction: number) {
    let value1: number, value2: number;

    // Extract values based on instruction
    if (instruction <= 0x1F) {
      // Compare with constants
      value1 = this.getRegisterForCmp(instruction);
      value2 = this.getConstantForCmp(instruction);
    } else {
      // Compare registers
      value1 = this.getRegisterForCmp((instruction >> 4) & 0x0F);
      value2 = this.getRegisterForCmp(instruction & 0x0F);
    }

    const result = value1 - value2;
    this.updateFlags(result);
  }

  private executeJump(instruction: number) {
    const condition = instruction & 0x0F;
    const jumpAddress = (this.rom[this.pc] << 8) | this.rom[this.pc + 1];
    
    if (this.shouldJump(condition)) {
      this.pc = jumpAddress;
    } else {
      this.pc += 2; // Skip address bytes
    }
  }

  private executeJumpRelative(instruction: number) {
    const condition = instruction & 0x0F;
    const offset = this.rom[this.pc];  // Get 8-bit offset
    
    // Convert to signed offset (-128 to +127)
    const signedOffset = offset & 0x80 ? (offset - 256) : offset;
    
    if (this.shouldJump(condition)) {
      this.pc = (this.pc + signedOffset + 1) & 0xFF;  // +1 to skip the offset byte
    } else {
      this.pc++; // Skip offset byte
    }
  }

  private executeALU(instruction: number) {
    let result = 0;
    
    switch(instruction) {
      // Control operations
      case 0x40: this.resetFlags(); break;
      case 0x41: this.cmpEnabled = false; break;
      case 0x42: this.cmpEnabled = true; break;
      case 0x43: this.signedMode = false; break;
      case 0x44: this.signedMode = true; break;

      // Basic operations
      case 0x45: result = 0; break;
      case 0x46: result = 1; break;
      case 0x47: result = -1; break;
      case 0x48: result = this.registerA; break;
      case 0x49: result = this.registerB; break;
      case 0x4A: result = this.registerC; break;
      case 0x4B: result = this.registerD; break;

      // Unary operations
      case 0x4C: result = ~this.registerA; break;
      case 0x4D: result = ~this.registerB; break;
      case 0x4E: result = ~this.registerC; break;
      case 0x4F: result = ~this.registerD; break;
      case 0x50: result = -this.registerA; break;
      case 0x51: result = -this.registerB; break;
      case 0x52: result = -this.registerC; break;
      case 0x53: result = -this.registerD; break;

      // Binary operations - Addition
      case 0x5C: result = this.registerA + this.registerB; break;
      case 0x5D: result = this.registerA + this.registerC; break;
      case 0x5E: result = this.registerA + this.registerD; break;
      case 0x5F: result = this.registerB + this.registerA; break;
      case 0x60: result = this.registerB + this.registerC; break;
      case 0x61: result = this.registerB + this.registerD; break;
      case 0x62: result = this.registerC + this.registerA; break;
      case 0x63: result = this.registerC + this.registerB; break;
      case 0x64: result = this.registerC + this.registerD; break;
      case 0x65: result = this.registerD + this.registerA; break;
      case 0x66: result = this.registerD + this.registerB; break;
      case 0x67: result = this.registerD + this.registerC; break;

      // Binary operations - Subtraction
      case 0x68: result = this.registerA - this.registerB; break;
      case 0x69: result = this.registerA - this.registerC; break;
      case 0x6A: result = this.registerA - this.registerD; break;
      case 0x6B: result = this.registerB - this.registerA; break;
      case 0x6C: result = this.registerB - this.registerC; break;
      case 0x6D: result = this.registerB - this.registerD; break;
      case 0x6E: result = this.registerC - this.registerA; break;
      case 0x6F: result = this.registerC - this.registerB; break;
      case 0x70: result = this.registerC - this.registerD; break;
      case 0x71: result = this.registerD - this.registerA; break;
      case 0x72: result = this.registerD - this.registerB; break;
      case 0x73: result = this.registerD - this.registerC; break;

      // Binary operations - Multiplication
      case 0x74: result = this.registerA * this.registerA; break;
      case 0x75: result = this.registerA * this.registerB; break;
      case 0x76: result = this.registerA * this.registerC; break;
      case 0x77: result = this.registerA * this.registerD; break;
      case 0x78: result = this.registerB * this.registerA; break;
      case 0x79: result = this.registerB * this.registerB; break;
      case 0x7A: result = this.registerB * this.registerC; break;
      case 0x7B: result = this.registerB * this.registerD; break;
      case 0x7C: result = this.registerC * this.registerA; break;
      case 0x7D: result = this.registerC * this.registerB; break;
      case 0x7E: result = this.registerC * this.registerC; break;
      case 0x7F: result = this.registerC * this.registerD; break;
      case 0x80: result = Math.floor(this.registerA / this.registerB); break;
      case 0x81: result = Math.floor(this.registerA / this.registerC); break;
      case 0x82: result = Math.floor(this.registerA / this.registerD); break;
      case 0x83: result = Math.floor(this.registerB / this.registerA); break;
      case 0x84: result = Math.floor(this.registerB / this.registerC); break;
      case 0x85: result = Math.floor(this.registerB / this.registerD); break;
      case 0x86: result = Math.floor(this.registerC / this.registerA); break;
      case 0x87: result = Math.floor(this.registerC / this.registerB); break;
      case 0x88: result = Math.floor(this.registerC / this.registerD); break;
      case 0x89: result = Math.floor(this.registerD / this.registerA); break;
      case 0x8A: result = Math.floor(this.registerD / this.registerB); break;
      case 0x8B: result = Math.floor(this.registerD / this.registerC); break;
      case 0x8C: result = this.registerA & this.registerB; break;
      case 0x8D: result = this.registerA & this.registerC; break;
      case 0x8E: result = this.registerA & this.registerD; break;
      case 0x8F: result = this.registerB & this.registerC; break;
      case 0x90: result = this.registerB & this.registerD; break;
      case 0x91: result = this.registerC & this.registerD; break;
      case 0x92: result = this.registerA | this.registerB; break;
      case 0x93: result = this.registerA | this.registerC; break;
      case 0x94: result = this.registerA | this.registerD; break;
      case 0x95: result = this.registerB | this.registerC; break;
      case 0x96: result = this.registerB | this.registerD; break;
      case 0x97: result = this.registerC | this.registerD; break;
      case 0x98: result = ~this.registerA; break;
      case 0x99: result = ~this.registerB; break;
      case 0x9A: result = ~this.registerC; break;
      case 0x9B: result = ~this.registerD; break;
      case 0x9C: result = 0; break;
      case 0x9D: result = 1; break;
      case 0x9E: result = -1; break;
      case 0x9F: result = 255; break;
    }

    // Update flags and store result in A register
    this.updateFlags(result);
    this.registerA = result & 0xFF;
  }

  private executeLoad(instruction: number) {
    let address: number;
    let value: number;
    let targetReg: number;

    if (instruction >= 0xB7 && instruction <= 0xC6) {
      // Load from RAM using register address
      const addrReg = Math.floor((instruction - 0xB7) / 4);
      targetReg = (instruction - 0xB7) % 4;
      address = this.getRegisterByIndex(addrReg) + (this.ramPage << 8);
      value = this.ram[address & 0xFF];
      this.setRegisterByIndex(targetReg, value);
    } else if (instruction >= 0xC7 && instruction <= 0xCA) {
      // Load immediate value from ROM
      targetReg = instruction - 0xC7;
      value = this.rom[this.pc++];
      this.setRegisterByIndex(targetReg, value);
    } else if (instruction >= 0xCB && instruction <= 0xCE) {
      // Load from RAM using constant address
      targetReg = instruction - 0xCB;
      address = this.rom[this.pc++];
      value = this.ram[address];
      this.setRegisterByIndex(targetReg, value);
    }
  }

  private executeSave(instruction: number) {
    let address: number;
    let value: number;
    let sourceReg: number;

    if (instruction >= 0xD3 && instruction <= 0xD6) {
      // Save to MAR
      sourceReg = instruction - 0xD3;
      this.mar = this.getRegisterByIndex(sourceReg);
    } else if (instruction >= 0xD7 && instruction <= 0xDA) {
      // Save to RAM at current MAR
      sourceReg = instruction - 0xD7;
      value = this.getRegisterByIndex(sourceReg);
      this.ram[this.mar] = value;
    } else if (instruction >= 0xDB && instruction <= 0xDE) {
      // Save to RAM using register address
      sourceReg = instruction - 0xDB;
      address = this.getRegisterByIndex(sourceReg);
      value = this.getRegisterByIndex(sourceReg);
      this.ram[address] = value;
    } else if (instruction >= 0xDF && instruction <= 0xE2) {
      // Save to RAM using constant address
      sourceReg = instruction - 0xDF;
      address = this.rom[this.pc++];
      value = this.getRegisterByIndex(sourceReg);
      this.ram[address] = value;
    }
  }

  private executeIO(instruction: number) {
    if (instruction >= 0xE4 && instruction <= 0xE7) {
      // OUT instruction
      const value = this.getRegisterValue(instruction - 0xE4);
      if (this.outputCallback) {
        this.outputCallback(value);
      }
    } else if (instruction >= 0xE0 && instruction <= 0xE3) {
      // IN instruction - not implemented yet
      const targetReg = instruction - 0xE0;
      this.setRegisterValue(targetReg, 0);
    } else if (instruction >= 0xE3 && instruction <= 0xE6) {
      // Input operations
      const targetReg = instruction - 0xE3;
      // In a real implementation, this would read from an input port
      this.setRegisterByIndex(targetReg, 0);
    } else if (instruction >= 0xE7 && instruction <= 0xEA) {
      // Output from register
      const sourceReg = instruction - 0xE7;
      const value = this.getRegisterByIndex(sourceReg);
      console.log(`Output: ${value}`);
    } else if (instruction === 0xEB) {
      // Output immediate value
      const value = this.rom[this.pc++];
      console.log(`Output: ${value}`);
    } else if (instruction === 0xEC) {
      // Output from RAM constant address
      const address = this.rom[this.pc++];
      console.log(`Output: ${this.ram[address]}`);
    } else if (instruction >= 0xED && instruction <= 0xF0) {
      // Output from RAM register address
      const reg = instruction - 0xED;
      const address = this.getRegisterByIndex(reg);
      console.log(`Output: ${this.ram[address]}`);
    }
  }

  private shouldJump(condition: number): boolean {
    switch(condition) {
      case 0x0: return true;  // Unconditional
      case 0x1: return this.zeroFlag;  // Equal
      case 0x2: return !this.zeroFlag; // Not Equal
      case 0x3: return !this.carryFlag; // Less Than (unsigned)
      case 0x4: return !this.carryFlag || this.zeroFlag; // Less Equal (unsigned)
      case 0x5: return this.carryFlag; // Greater Than (unsigned)
      case 0x6: return this.carryFlag || this.zeroFlag; // Greater Equal (unsigned)
      case 0x7: return this.signFlag !== this.overflowFlag; // Less Than (signed)
      case 0x8: return this.signFlag !== this.overflowFlag || this.zeroFlag; // Less Equal (signed)
      case 0x9: return this.signFlag === this.overflowFlag; // Greater Than (signed)
      case 0xA: return this.signFlag === this.overflowFlag || this.zeroFlag; // Greater Equal (signed)
      case 0xB: return this.zeroFlag; // Zero flag set
      case 0xC: return this.overflowFlag; // Overflow flag set
      case 0xD: return this.carryFlag; // Carry flag set
      case 0xE: return this.signFlag; // Sign flag set
      default: return false;
    }
  }

  private getRegisterByIndex(index: number): number {
    switch(index) {
      case 0: return this.registerA;
      case 1: return this.registerB;
      case 2: return this.registerC;
      case 3: return this.registerD;
      default: return 0;
    }
  }

  private setRegisterByIndex(index: number, value: number) {
    value &= 0xFF; // Ensure 8-bit value
    switch(index) {
      case 0: this.registerA = value; break;
      case 1: this.registerB = value; break;
      case 2: this.registerC = value; break;
      case 3: this.registerD = value; break;
    }
  }

  private getRegisterForCmp(reg: number): number {
    switch(reg & 0x03) {
      case 0: return this.registerA;
      case 1: return this.registerB;
      case 2: return this.registerC;
      case 3: return this.registerD;
      default: return 0;
    }
  }

  private getConstantForCmp(instruction: number): number {
    const type = (instruction >> 2) & 0x03;
    switch(type) {
      case 0: return 0;
      case 1: return 1;
      case 2: return -1;
      case 3: return 255;
      default: return 0;
    }
  }

  private getRegisterValue(index: number): number {
    switch (index) {
      case 0: return this.registerA;
      case 1: return this.registerB;
      case 2: return this.registerC;
      case 3: return this.registerD;
      default: return 0;
    }
  }

  private setRegisterValue(index: number, value: number) {
    switch (index) {
      case 0: this.registerA = value; break;
      case 1: this.registerB = value; break;
      case 2: this.registerC = value; break;
      case 3: this.registerD = value; break;
    }
  }

  setOutputCallback(callback: (value: number) => void) {
    this.outputCallback = callback;
  }

  // Debug methods
  getRegisterA(): number { return this.registerA; }
  getRegisterB(): number { return this.registerB; }
  getRegisterC(): number { return this.registerC; }
  getRegisterD(): number { return this.registerD; }
  getProgramCounter(): number { return this.pc; }
  getCurrentInstruction(): number { return this.rom[this.pc]; }
  getFlags(): { z: boolean, o: boolean, c: boolean, s: boolean } {
    return {
      z: this.zeroFlag,
      o: this.overflowFlag,
      c: this.carryFlag,
      s: this.signFlag
    };
  }
}