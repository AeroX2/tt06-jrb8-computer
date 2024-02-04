import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles


async def setup(dut):
    computer = dut.tt_um_aerox2_jrb8_computer
    clk = computer.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    computer.rst.value = 1
    await Timer(1)
    computer.rst.value = 0
    await Timer(1)

    return computer, clk

def send_rom_data():
    pc = 0
    for i in range(16):
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it
        pc |= computer.serial_out.value.integer << (15 - i)

    computer.ready.value = 0
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert computer.rom.value == 0
    computer.ready.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it

    input = random.randint(0, 255)
    for i in range(8):
        computer.serial_in.value = (input >> (7 - i)) & 1

@cocotb.test()
async def test_full(dut):
    computer, clk = await setup(dut)

    await RisingEdge(computer.uo_out)

