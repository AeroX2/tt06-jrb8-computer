import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles

def setup(dut):
    cmp = dut.tt_um_jrb8_computer.cmp
    clk = cmp.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())
    return cmp, clk

@cocotb.test()
async def test_cmp_sanity(dut):
    cmp, clk = setup(dut) 

    #c = Clock(dut.cmp.clk, 10, 'ns')
    #cocotb.start(c.start())
    cmp.reset.value = 1
    await Timer(1)
    cmp.reset.value = 0
    await Timer(1)
    
    await ClockCycles(clk, 10)

    assert cmp.zflag == 0
    assert cmp.oflag == 0
    assert cmp.cflag == 0
    assert cmp.sflag == 0
    
@cocotb.test()
async def test_cmp_values_set(dut):
    cmp, clk = setup(dut)

    cmp.reset.value = 1
    await Timer(1)
    cmp.reset.value = 0
    await Timer(1)

    await ClockCycles(clk, 10)
    cmp.we.value = 1;

    cmp.carry.value = 1
    await ClockCycles(clk, 2)
    assert cmp.cflag.value == 1

    cmp.overflow.value = 1
    await ClockCycles(clk, 2)
    assert cmp.cflag.value == 1

    cmp.cmpin.value = 0;
    await ClockCycles(clk, 2)
    assert cmp.zflag.value == 1

    cmp.cmpin.value = random.randint(-127, -1);
    await ClockCycles(clk, 2)
    assert cmp.sflag.value == 1


