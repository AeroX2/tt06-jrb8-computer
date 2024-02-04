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
    computer.ready.value = 0

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
    
    pc_value = random.randint(0, 65536)
    computer.romo.value = 1
    computer.pc.value = pc_value
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.serial_out.value == 0

    computer.ready.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it

    pc_output = 0
    for i in range(16):
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it
        pc_output |= computer.serial_out.value.integer << (15 - i)
    assert bin(pc_output) == bin(pc_value)

    computer.ready.value = 0
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.rom.value == 0
    computer.ready.value = 1
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
    computer, sclk = await setup(dut)
    
    computer.rami.value = 1
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.ram.value == 0

    computer.ready.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it

    input = random.randint(0, 255)
    for i in range(8):
        computer.serial_in.value = (input >> (7 - i)) & 1
        await Timer(1)  # <= causes a slight delay, wait for it
        await ClockCycles(sclk, 1)
    # Wait for last value to be clocked in on the falling edge
    await ClockCycles(sclk, 1, False)
    await Timer(1)  # <= causes a slight delay, wait for it

    assert bin(computer.ram.value.integer) == bin(input)


@cocotb.test()
async def test_serial_ram_out(dut):
    computer, sclk = await setup(dut)
    
    ram_value = random.randint(0, 255)
    computer.ramo.value = 1
    computer.ram.value = ram_value
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.serial_out.value == 0

    computer.ready.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it

    ram_output = 0
    for i in range(8):
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it
        ram_output |= computer.serial_out.value.integer << (7 - i)
    assert bin(ram_output) == bin(ram_value)
