import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import ClockCycles


async def setup(dut):
    jmp = dut.tt_um_aerox2_jrb8_computer.jmp_module
    clk = jmp.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    jmp.rst.value = 1
    await ClockCycles(clk, 1)
    jmp.rst.value = 0
    await ClockCycles(clk, 1)

    return jmp, clk


async def jmp_tick(jmp, clk):
    pc_value_high = random.randint(0, 255)
    jmp.databus.value = pc_value_high
    await ClockCycles(clk, 1)
    assert jmp.pcoe.value == 0
    pc_value_low = random.randint(0, 255)
    jmp.databus.value = pc_value_low

    jmp.oe.value = 1
    await ClockCycles(clk, 1)

    return pc_value_high << 8 | pc_value_low


@cocotb.test()
async def test_jmp_sanity(dut):
    jmp, clk = await setup(dut)

    jmp.oe.value = 0
    await ClockCycles(clk, 10)

    assert jmp.pcoe.value == 0
    assert jmp.pcout.value == 0


@cocotb.test()
async def test_jmp_jumps_correctly(dut):
    jmp, clk = await setup(dut)

    # No condition, always jump
    jmp.cins.value = 0x30
    pc_out = await jmp_tick(jmp, clk)
    assert jmp.pcoe.value == 1
    assert jmp.pcout.value == pc_out


@cocotb.test()
async def test_jmp_conditions(dut):
    jmp, clk = await setup(dut)

    # = condition
    jmp.cins.value = 0x31
    jmp.zflag.value = 1
    await ClockCycles(clk, 1)
    assert jmp.pcoe.value == 1
    jmp.cins.value = 0x31
    jmp.zflag.value = 0
    await ClockCycles(clk, 1)
    assert jmp.pcoe.value == 0

    # != condition
    jmp.cins.value = 0x32
    jmp.zflag.value = 1
    await ClockCycles(clk, 1)
    assert jmp.pcoe.value == 0
    jmp.cins.value = 0x32
    jmp.zflag.value = 0
    await ClockCycles(clk, 1)
    assert jmp.pcoe.value == 1

    # Realistically we should also test all the other conditions but
    # its a little complex and this should hopefully be tested by the
    # full integration test
