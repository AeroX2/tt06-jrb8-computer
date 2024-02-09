import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles, with_timeout

ROM = [
   0x60, 0x10, 0x61, 0x12, 0x4d, 0x90, 0x20, 0x0,  
]

class MicroMock(object):
     def __init__(self, **kwargs):
         self.__dict__.update(kwargs)

async def setup(dut):
    computer = dut.tt_um_aerox2_jrb8_computer
    clk = computer.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    computer.rst_n.value = 1
    await Timer(1)
    computer.rst_n.value = 0
    await Timer(1)
    computer.rst_n.value = 1
    await Timer(1)

    mock = MicroMock(
        ui_in=computer.ui_in,
        uo_out=computer.uo_out,
        uio_in=computer.uio_in,
        uio_out=computer.uio_out,
        uio_oe=computer.uio_oe,
        ena=computer.ena,
        rst_n=computer.rst_n,
    )

    return mock, clk

async def send_rom_data(computer, sclk):
    await ClockCycles(sclk, 8)

    pc = 0
    for i in range(16):
        pc |= computer.uio_out[1].value.integer << (15 - i)
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it

    data = ROM[pc]
    for i in range(8):
        computer.uio_in[2].value = (data >> (7 - i)) & 1
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it

@cocotb.test()
async def test_full(dut):
    computer, clk = await setup(dut)

    # Only for debugging
    _computer = dut.tt_um_aerox2_jrb8_computer

    print("PC", _computer.pc.value.integer)
    print("ROM[PC]", _computer.rom.value.integer)

    computer.uio_in[4].value = 1
    sclk = Clock(computer.uio_in[3], 10, units="us")

    for _ in range(20):
        print("PC", _computer.pc.value.integer)
        print("ROM[PC]", _computer.rom.value.integer)

        await ClockCycles(clk, 1)
        if (computer.uio_out[0] == 0):
            await send_rom_data(computer, sclk)

        

