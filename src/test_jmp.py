import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles


def setup(dut):
    jmp = dut.tt_um_jrb8_computer.jmp
    clk = jmp.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())
    return jmp, clk


@cocotb.test()
async def test_jmp_sanity(dut):
    jmp, clk = setup(dut)

    # c = Clock(dut.cmp.clk, 10, 'ns')
    # cocotb.start(c.start())
    jmp.reset.value = 1
    await ClockCycles(clk, 1)
    jmp.reset.value = 0
    await ClockCycles(clk, 1)

    jmp.oe.value = 0
    await ClockCycles(clk, 10)

    assert jmp.pcoe.value == 0
    assert jmp.pcout.value == 0


@cocotb.test()
async def test_jmp_conditions(dut):
    jmp, clk = setup(dut)

    jmp.reset.value = 1
    await ClockCycles(clk, 1)
    jmp.reset.value = 0
    await ClockCycles(clk, 1)

    jmp.oe.value = 1

    # No condition, always jump
    jmp.cins.value = 0x30
    pc_value_low = random.randint(-127, 127)
    jmp.databus.value = pc_value_low
    await ClockCycles(clk, 1)
    assert jmp.pcoe.value == 0
    pc_value_high = random.randint(-127, 127)
    jmp.databus.value = pc_value_high
    await ClockCycles(clk, 1)
    print(jmp.pcout.value)
    assert jmp.pcout.value == (pc_value_high << 8 | pc_value_low)
