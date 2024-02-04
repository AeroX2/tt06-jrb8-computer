import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles


async def setup(dut):
    computer = dut.tt_um_aerox2_jrb8_computer
    sclk = computer.sclk

    computer.romo.value = 0
    computer.rami.value = 0
    computer.ramo.value = 0

    clock = Clock(sclk, 10, units="us")
    cocotb.start_soon(clock.start())

    computer.rst.value = 1
    await Timer(1)
    computer.rst.value = 0
    await Timer(1)

    return computer, sclk


@cocotb.test()
async def test_serial_rom_out(dut):
    computer, sclk = await setup(dut)

    pc = random.randint(0, 65536)
    computer.romo.value = 1
    computer.pc.value = pc
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.serial_out.value == 0

    computer.ready.value = 1
    await ClockCycles(sclk, 1)
    await Timer(1)  # `<=` causes a slight delay, wait for it

    pc_output = 0
    for i in range(16):
        pc_output |= computer.serial_out.value.integer << (15 - i)
        print("b", computer.serial_counter.value.integer)
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it
        print("a", computer.serial_counter.value.integer)
    assert bin(pc_output) == bin(pc)

    print(computer.rom.value)
    computer.ready.value = 0
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.rom.value == 0
    computer.ready.value = 1
    await ClockCycles(sclk, 1)
    await Timer(1)  # `<=` causes a slight delay, wait for it

    input = random.randint(0, 255)
    for i in range(8):
        computer.serial_in.value = (input >> (7 - i)) & 1
        await Timer(1)  # <= causes a slight delay, wait for it
        await ClockCycles(sclk, 1)
    # Wait for last value to be clocked in on the falling edge
    await ClockCycles(sclk, 1, False)
    await Timer(1)  # <= causes a slight delay, wait for it

    assert bin(computer.rom.value.integer) == bin(input)


@cocotb.test()
async def test_serial_ram_in(dut):
    computer, clk = await setup(dut)
    computer.rami.value = 1
    await ClockCycles(clk, 1)

    input = random.randint(0, 255)

    for i in range(8):
        computer.ui_in[1].value = (input >> (7 - i)) & 1
        await ClockCycles(clk, 1)

    # Wait for last value to be clocked in on the falling edge
    await ClockCycles(clk, 1, False)

    assert computer.ram.value == input


@cocotb.test()
async def test_serial_ram_out(dut):
    computer, clk = await setup(dut)

    input = random.randint(0, 255)
    computer.ramo.value = 1
    computer.ram.value = input
    await ClockCycles(clk, 2)

    output = 0
    for i in range(8):
        output |= computer.uo_out[1].value.integer << (7 - i)
        await ClockCycles(clk, 1)

    # Wait for last value to be clocked in on the falling edge
    await ClockCycles(clk, 1, False)

    assert output == input
