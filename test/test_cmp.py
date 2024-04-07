import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import Timer, ClockCycles
from cocotb.handle import Force


async def setup(dut):
    cmp = dut.tt_um_aerox2_jrb8_computer.cmp_module
    clk = cmp.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    cmp.rst.value = 1
    await Timer(1)
    cmp.rst.value = 0
    await Timer(1)

    return cmp, clk


@cocotb.test()
async def test_cmp_sanity(dut):
    cmp, clk = await setup(dut)

    cmp.we.value = Force(0)
    await ClockCycles(clk, 10)

    assert cmp.zflag.value == 0
    assert cmp.oflag.value == 0
    assert cmp.cflag.value == 0
    assert cmp.sflag.value == 0


@cocotb.test()
async def test_cmp_values_set(dut):
    cmp, clk = await setup(dut)

    await ClockCycles(clk, 10)
    cmp.we.value = Force(1)

    cmp.carry.value = Force(1)
    await ClockCycles(clk, 2)
    assert cmp.cflag.value == 1

    cmp.overflow.value = Force(1)
    await ClockCycles(clk, 2)
    assert cmp.oflag.value == 1

    cmp.cmpin.value = Force(0)
    await ClockCycles(clk, 2)
    assert cmp.zflag.value == 1

    cmp.cmpin.value = Force(random.randint(-127, -1))
    await ClockCycles(clk, 2)
    assert cmp.sflag.value == 1
