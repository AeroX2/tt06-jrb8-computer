import { Lexer } from "../core/lexer";
import { Parser } from "../core/parser";
import { HardwareCompiler } from "../vm/hardware_compiler";
import { HardwareVM } from "../vm/hardware_vm";
import * as fs from "fs";
import * as path from "path";

function run(source: string): { output: number[]; vm: HardwareVM } {
  const ast = new Parser(new Lexer(source).scanTokens()).parse();
  const compiler = new HardwareCompiler();
  const bytecode = compiler.compileToBytecode(compiler.compileToAssembly(ast));
  const vm = new HardwareVM();
  const output: number[] = [];
  vm.setOutputCallback(value => output.push(value));
  vm.loadProgram(bytecode);

  let steps = 10000;
  while (vm.step() && --steps > 0) {
    // run until halt
  }
  expect(steps).toBeGreaterThan(0);
  return { output, vm };
}

describe("hardware compiler code generation", () => {
  test("preserves operands in nested expressions", () => {
    const { output } = run(`
      var a = 20
      var b = 7
      var c = 3
      out (a + b) - c
      out a < (b + c)
      out (a + b) / c
    `);
    expect(output).toEqual([24, 0, 9]);
  });

  test("peek and poke access paged RAM and restore page zero", () => {
    const { output, vm } = run(`
      var page = 3
      var offset = 40
      var value = 0xA5
      poke(page, offset + 2, value)
      out peek(page, offset + 2)
      value = value + 1
      out value
    `);
    expect(output).toEqual([0xa5, 0xa6]);
    expect(vm.getRam()[(3 << 8) | 42]).toBe(0xa5);
  });

  test("i2c8 emits an MSB-first byte followed by an ACK clock", () => {
    const { output } = run(`
      var value = 0xA5
      i2c8(value)
    `);
    expect(output).toEqual([
      1,
      3,
      1, // 1
      0,
      2,
      0, // 0
      1,
      3,
      1, // 1
      0,
      2,
      0, // 0
      0,
      2,
      0, // 0
      1,
      3,
      1, // 1
      0,
      2,
      0, // 0
      1,
      3,
      1, // 1
      1,
      3,
      1, // ACK clock
    ]);
  });

  test("SSD1306 JRP demo renders and transmits its first frame", () => {
    const examples = path.join(__dirname, "../../../example_programs/jrp");
    const source = fs.readFileSync(path.join(examples, "ssd1306_demo.jrp"), "utf8");
    const data = fs.readFileSync(path.join(examples, "ssd1306_demo_data.bin"));
    const ast = new Parser(new Lexer(source).scanTokens()).parse();
    const compiler = new HardwareCompiler();
    const bytecode = compiler.compileToBytecode(compiler.compileToAssembly(ast));
    const vm = new HardwareVM();
    let outputCount = 0;
    vm.setOutputCallback(() => outputCount++);
    vm.loadProgram(bytecode);
    data.forEach((value, address) => (vm.getRam()[address] = value));

    // 26 init transactions plus one window command and one 1024-byte frame.
    const firstFrameOutputCount = 26 * 87 + 222 + 27708;
    let steps = 2_000_000;
    while (outputCount < firstFrameOutputCount && vm.step() && --steps > 0) {
      // run through the first frame
    }
    while (vm.getRam()[0] === 0 && vm.step() && --steps > 0) {
      // finish the frame-counter update after the final I2C output
    }

    expect(steps).toBeGreaterThan(0);
    expect(outputCount).toBe(firstFrameOutputCount);
    const framebuffer = vm.getRam().slice(3 << 8, 11 << 8);
    expect(framebuffer.some(value => value !== 0)).toBe(true);
    expect(
      Array.from({ length: 8 }, (_, index) => [
        vm.getRam()[(2 << 8) + 128 + index * 2],
        vm.getRam()[(2 << 8) + 129 + index * 2],
      ])
    ).toEqual([
      [53, 21],
      [73, 31],
      [65, 51],
      [45, 41],
      [63, 13],
      [83, 23],
      [75, 43],
      [55, 33],
    ]);
    expect(vm.getRam()[0]).toBe(1); // frame counter advanced
  }, 30000);
});
