export enum Register {
  A,
  B,
  C,
  D
}

export enum CompareTarget {
  ZERO,
  ONE,
  MINUS_ONE,
  MAX // 255
}

export enum JumpCondition {
  ALWAYS,
  EQUAL,
  NOT_EQUAL,
  LESS_THAN,
  LESS_EQUAL,
  GREATER_THAN,
  GREATER_EQUAL,
  LESS_THAN_SIGNED,
  LESS_EQUAL_SIGNED,
  GREATER_THAN_SIGNED,
  GREATER_EQUAL_SIGNED,
  ZERO_FLAG,
  OVERFLOW_FLAG,
  CARRY_FLAG,
  SIGN_FLAG
}

export enum OPPOperation {
  // Control operations
  RESET_FLAGS = 0x00,
  CMP_OFF = 0x01,
  CMP_ON = 0x02,
  SIGNED_OFF = 0x03,
  SIGNED_ON = 0x04,

  // Basic operations
  ZERO = 0x05,
  ONE = 0x06,
  NEG_ONE = 0x07,
  COPY_A = 0x08,
  COPY_B = 0x09,
  COPY_C = 0x0A,
  COPY_D = 0x0B,

  // Unary operations
  NOT_A = 0x0C,
  NOT_B = 0x0D,
  NOT_C = 0x0E,
  NOT_D = 0x0F,
  NEG_A = 0x10,
  NEG_B = 0x11,
  NEG_C = 0x12,
  NEG_D = 0x13,

  // Binary operations - Addition
  ADD_AB = 0x1C,
  ADD_AC = 0x1D,
  ADD_AD = 0x1E,
  ADD_BA = 0x1F,
  ADD_BC = 0x20,
  ADD_BD = 0x21,
  ADD_CA = 0x22,
  ADD_CB = 0x23,
  ADD_CD = 0x24,
  ADD_DA = 0x25,
  ADD_DB = 0x26,
  ADD_DC = 0x27,

  // Binary operations - Subtraction
  SUB_AB = 0x28,
  SUB_AC = 0x29,
  SUB_AD = 0x2A,
  SUB_BA = 0x2B,
  SUB_BC = 0x2C,
  SUB_BD = 0x2D,
  SUB_CA = 0x2E,
  SUB_CB = 0x2F,
  SUB_CD = 0x30,
  SUB_DA = 0x31,
  SUB_DB = 0x32,
  SUB_DC = 0x33,

  // Binary operations - Multiplication
  MUL_AB = 0x34,
  MUL_AC = 0x35,
  MUL_AD = 0x36,
  MUL_BA = 0x37,
  MUL_BB = 0x38,
  MUL_BC = 0x39,
  MUL_BD = 0x3A,
  MUL_CA = 0x3B,
  MUL_CB = 0x3C,
  MUL_CC = 0x3D,
  MUL_CD = 0x3E,
  MUL_DA = 0x3F,

  // Binary operations - Division
  DIV_AB = 0x40,
  DIV_AC = 0x41,
  DIV_AD = 0x42,
  DIV_BA = 0x43,
  DIV_BC = 0x44,
  DIV_BD = 0x45,
  DIV_CA = 0x46,
  DIV_CB = 0x47,
  DIV_CD = 0x48,
  DIV_DA = 0x49,
  DIV_DB = 0x4A,
  DIV_DC = 0x4B,

  // Binary operations - Logical AND
  AND_AB = 0x4C,
  AND_AC = 0x4D,
  AND_AD = 0x4E,
  AND_BC = 0x4F,
  AND_BD = 0x50,
  AND_CD = 0x51,

  // Binary operations - Logical OR
  OR_AB = 0x52,
  OR_AC = 0x53,
  OR_AD = 0x54,
  OR_BC = 0x55,
  OR_BD = 0x56,
  OR_CD = 0x57,
}

export type Instruction = 
  | { type: 'NOP' }
  | { type: 'MOV', from: Register, to: Register }
  | { type: 'CMP_REG', reg1: Register, reg2: Register }
  | { type: 'CMP_CONST', reg: Register, target: CompareTarget }
  | { type: 'JMP', condition: JumpCondition, address: number, label?: string }
  | { type: 'JMPR', condition: JumpCondition, offset: number, label?: string }
  | { type: 'OPP', operation: OPPOperation }
  | { type: 'LOAD_RAM_REG', address_reg: Register, target_reg: Register }
  | { type: 'LOAD_RAM_CONST', address: number, target_reg: Register }
  | { type: 'LOAD_ROM', value: number, target_reg: Register }
  | { type: 'SET_RAM_PAGE', from_reg: Register }
  | { type: 'SAVE_MAR', from_reg: Register }
  | { type: 'SAVE_RAM_CURRENT', from_reg: Register }
  | { type: 'SAVE_RAM_REG', address_reg: Register, from_reg: Register }
  | { type: 'SAVE_RAM_CONST', address: number, from_reg: Register }
  | { type: 'IN', target_reg: Register }
  | { type: 'OUT', from_reg: Register }
  | { type: 'HALT' }
  | { type: 'LABEL', label: string };

// Translation layer to convert instructions to machine code
export function translateInstruction(instruction: Instruction): number[] {
  switch (instruction.type) {
    case 'NOP':
      return [0x00];

    case 'MOV':
      return [0x01 + (instruction.from * 3) + instruction.to];

    case 'CMP_CONST':
      return [0x10 + (instruction.reg * 4) + instruction.target];

    case 'CMP_REG':
      return [0x20 + (instruction.reg1 * 4) + instruction.reg2];

    case 'JMP':
      return [0x30 + instruction.condition, instruction.address & 0xFF, (instruction.address >> 8) & 0xFF];

    case 'JMPR':
      return [0x40 + instruction.condition, instruction.offset & 0xFF];

    case 'OPP':
      return [0x50 + instruction.operation];

    case 'LOAD_RAM_REG':
      return [0xB0 + (instruction.address_reg * 4) + instruction.target_reg];

    case 'LOAD_ROM':
      return [0xC0 + instruction.target_reg, instruction.value];

    case 'LOAD_RAM_CONST':
      return [0xC4 + instruction.target_reg, instruction.address];

    case 'SET_RAM_PAGE':
      return [0xC8 + instruction.from_reg];

    case 'SAVE_MAR':
      return [0xD0 + instruction.from_reg];

    case 'SAVE_RAM_CURRENT':
      return [0xD4 + instruction.from_reg];

    case 'SAVE_RAM_REG':
      return [0xD8 + (instruction.address_reg * 4) + instruction.from_reg];

    case 'SAVE_RAM_CONST':
      return [0xDC + instruction.from_reg, instruction.address];

    case 'IN':
      return [0xE0 + instruction.target_reg];

    case 'OUT':
      return [0xE4 + instruction.from_reg];

    case 'HALT':
      return [0xFF];
      
    case 'LABEL':
      return []; // Labels don't generate machine code
  }
} 