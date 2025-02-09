export interface DecodedInstruction {
  address: number;
  byte: number;
  instruction: string;
  extraInfo?: string;
  nextIndex: number;
}

function getRegisterName(index: number): string {
  switch (index) {
    case 0: return 'A';
    case 1: return 'B';
    case 2: return 'C';
    case 3: return 'D';
    default: return '?';
  }
}

function getCompareTarget(index: number): string {
  switch (index & 0x03) {
    case 0: return 'ZERO';
    case 1: return 'ONE';
    case 2: return 'MINUS_ONE';
    case 3: return 'MAX';
    default: return '?';
  }
}

function getCompareRegisters(offset: number): string {
  const reg1 = Math.floor(offset / 4);
  const reg2 = offset % 4;
  return `${getRegisterName(reg1)},${getRegisterName(reg2)}`;
}

function getLoadRamReg(offset: number): string {
  const addrReg = Math.floor(offset / 4);
  const targetReg = offset % 4;
  return `[${getRegisterName(addrReg)}]→${getRegisterName(targetReg)}`;
}

function getSaveRamReg(offset: number): string {
  const addrReg = Math.floor(offset / 4);
  const fromReg = offset % 4;
  return `${getRegisterName(fromReg)}→[${getRegisterName(addrReg)}]`;
}

function getJumpCondition(index: number): string {
  switch (index) {
    case 0x0: return 'ALWAYS';
    case 0x1: return 'EQ';
    case 0x2: return 'NE';
    case 0x3: return 'LT';
    case 0x4: return 'LE';
    case 0x5: return 'GT';
    case 0x6: return 'GE';
    case 0x7: return 'LTS';
    case 0x8: return 'LES';
    case 0x9: return 'GTS';
    case 0xA: return 'GES';
    case 0xB: return 'Z';
    case 0xC: return 'O';
    case 0xD: return 'C';
    case 0xE: return 'S';
    default: return '?';
  }
}

function getALUOperation(index: number): string {
  // Control operations (0x4B-0x4F)
  if (index === 0) return 'CLR';
  if (index === 1) return 'CMP_OFF';
  if (index === 2) return 'CMP_ON';
  if (index === 3) return 'SIGNED_OFF';
  if (index === 4) return 'SIGNED_ON';

  // Basic operations (0x50-0x56)
  if (index === 5) return '0';
  if (index === 6) return '1';
  if (index === 7) return '-1';
  if (index >= 8 && index <= 11) return getRegisterName(index - 8);

  // Unary operations (0x57-0x66)
  if (index >= 12 && index <= 15) return `~${getRegisterName(index - 12)}`;
  if (index >= 16 && index <= 19) return `-${getRegisterName(index - 16)}`;
  if (index >= 20 && index <= 23) return `${getRegisterName(index - 20)}+1`;
  if (index >= 24 && index <= 27) return `${getRegisterName(index - 24)}-1`;

  // Binary operations (0x67-0xB6)
  if (index >= 28 && index <= 39) {
    const base = index - 28;
    const reg1 = Math.floor(base / 4);
    const reg2 = base % 4;
    return `${getRegisterName(reg1)}+${getRegisterName(reg2)}`;
  }
  if (index >= 40 && index <= 51) {
    const base = index - 40;
    const reg1 = Math.floor(base / 4);
    const reg2 = base % 4;
    return `${getRegisterName(reg1)}-${getRegisterName(reg2)}`;
  }
  if (index >= 52 && index <= 63) {
    const base = index - 52;
    const reg1 = Math.floor(base / 4);
    const reg2 = base % 4;
    return `${getRegisterName(reg1)}*${getRegisterName(reg2)}`;
  }
  if (index >= 64 && index <= 75) {
    const base = index - 64;
    const reg1 = Math.floor(base / 4);
    const reg2 = base % 4;
    return `${getRegisterName(reg1)}/${getRegisterName(reg2)}`;
  }
  if (index >= 76 && index <= 81) {
    const base = index - 76;
    const reg1 = Math.floor(base / 2);
    const reg2 = base % 2 + (reg1 < 2 ? 2 : 0);
    return `${getRegisterName(reg1)}&${getRegisterName(reg2)}`;
  }
  if (index >= 82 && index <= 87) {
    const base = index - 82;
    const reg1 = Math.floor(base / 2);
    const reg2 = base % 2 + (reg1 < 2 ? 2 : 0);
    return `${getRegisterName(reg1)}|${getRegisterName(reg2)}`;
  }

  return `UNKNOWN_ALU(${index})`;
}

export function decodeInstruction(program: number[], index: number): DecodedInstruction {
  const byte = program[index];
  let instruction = '';
  let extraInfo = '';
  let nextIndex = index + 1;

  if (byte === 0x00) {
    instruction = 'NOP';
  } else if (byte >= 0x01 && byte <= 0x0C) {
    // MOV instructions (0x01-0x0C)
    const offset = byte - 0x01;
    const fromReg = Math.floor(offset / 3);
    const toReg = offset % 3;
    const adjustedToReg = toReg + (toReg >= fromReg ? 1 : 0);
    instruction = `MOV ${getRegisterName(fromReg)}→${getRegisterName(adjustedToReg)}`;
  } else if (byte >= 0x0D && byte <= 0x1C) {
    // CMP with constants (0x0D-0x1C)
    const reg = Math.floor((byte - 0x0D) / 4);
    const target = (byte - 0x0D) % 4;
    instruction = `CMP ${getRegisterName(reg)},${getCompareTarget(target)}`;
  } else if (byte >= 0x1D && byte <= 0x2C) {
    // CMP between registers (0x1D-0x2C)
    const offset = byte - 0x1D;
    const reg1 = Math.floor(offset / 4);
    const reg2 = offset % 4;
    instruction = `CMP ${getRegisterName(reg1)},${getRegisterName(reg2)}`;
  } else if (byte >= 0x2D && byte <= 0x37) {
    // JMP instructions (0x2D-0x37)
    const condition = getJumpCondition(byte - 0x2D);
    const addr = program[index + 1];
    instruction = `JMP.${condition}`;
    extraInfo = `addr: 0x${addr.toString(16).padStart(2, '0')}`;
    nextIndex++;
  } else if (byte >= 0x38 && byte <= 0x4A) {
    // JMPR instructions (0x38-0x4A)
    const condition = getJumpCondition(byte - 0x38);
    const offset = program[index + 1];
    instruction = `JMPR.${condition}`;
    extraInfo = `offset: 0x${offset.toString(16).padStart(2, '0')}`;
    nextIndex++;
  } else if (byte >= 0x4B && byte <= 0xB6) {
    // ALU operations (0x4B-0xB6)
    instruction = `OPP ${getALUOperation(byte - 0x4B)}`;
  } else if (byte >= 0xB7 && byte <= 0xC6) {
    // LOAD ram[reg] instructions (0xB7-0xC6)
    instruction = `LOAD ${getLoadRamReg(byte - 0xB7)}`;
  } else if (byte >= 0xC7 && byte <= 0xCA) {
    // LOAD immediate (0xC7-0xCA)
    const value = program[index + 1];
    const targetReg = byte - 0xC7;
    instruction = `LOAD #${value}→${getRegisterName(targetReg)}`;
    nextIndex++;
  } else if (byte >= 0xCB && byte <= 0xCE) {
    // LOAD from memory address (0xCB-0xCE)
    const addr = program[index + 1];
    const targetReg = byte - 0xCB;
    instruction = `LOAD [${addr.toString(16).padStart(2, '0')}]→${getRegisterName(targetReg)}`;
    nextIndex++;
  } else if (byte >= 0xCF && byte <= 0xD2) {
    // SAVE to ram[reg] (0xCF-0xD2)
    instruction = `SAVE ${getSaveRamReg(byte - 0xCF)}`;
  } else if (byte >= 0xD3 && byte <= 0xD6) {
    // SAVE to memory address (0xD3-0xD6)
    const addr = program[index + 1];
    const fromReg = byte - 0xD3;
    instruction = `SAVE ${getRegisterName(fromReg)}→[${addr.toString(16).padStart(2, '0')}]`;
    nextIndex++;
  } else if (byte >= 0xE3 && byte <= 0xE6) {
    // IN instructions (0xE3-0xE6)
    const reg = byte - 0xE3;
    instruction = `IN →${getRegisterName(reg)}`;
  } else if (byte >= 0xE7 && byte <= 0xEA) {
    // OUT instructions (0xE7-0xEA)
    const reg = byte - 0xE7;
    instruction = `OUT ${getRegisterName(reg)}`;
  } else if (byte === 0xFF) {
    instruction = 'HALT';
  } else {
    instruction = `UNKNOWN(0x${byte.toString(16).padStart(2, '0')})`;
  }

  return {
    address: index,
    byte,
    instruction,
    extraInfo: extraInfo || undefined,
    nextIndex
  };
}

export function formatInstruction(decoded: DecodedInstruction): string {
  const { address, byte, instruction, extraInfo } = decoded;
  return `0x${address.toString(16).padStart(4, '0')}: 0x${byte.toString(16).padStart(2, '0')} - ${instruction.padEnd(25)}${extraInfo || ''}`;
}