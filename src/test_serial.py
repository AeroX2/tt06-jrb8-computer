import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles


async def setup(dut):
    spi = dut.tt_um_aerox2_jrb8_computer.spi
    sclk = spi.sclk

    spi.ready.value = 0

    clock = Clock(sclk, 10, units="us")
    cocotb.start_soon(clock.start())

    spi.rst.value = 1
    await Timer(1)
    spi.rst.value = 0
    await Timer(1)

    return spi, sclk


@cocotb.test()
async def test_serial_rom_out(dut):
    spi, sclk = await setup(dut)
    
    IDLE = 0
    SEND_COMMAND = 1
    SEND_ADDRESS = 2
    RECEIVE_DATA = 3
    
    pc_value = random.randint(0, 65536)
    spi.address.value = pc_value
    await ClockCycles(sclk, 100)  # We should be able to wait here forever until ready
    assert spi.state.value == IDLE
    assert spi.cs.value == 1
    assert spi.mosi.value == 0

    spi.ready.value = 1
    await ClockCycles(sclk, 1)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_COMMAND
    assert spi.cs.value == 0
    assert spi.mosi.value == 0

    output = 0
    for i in range(8):
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x03 #SPI Read command is 0x03
    assert spi.state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await ClockCycles(sclk, 1)
        await Timer(1)  # <= causes a slight delay, wait for it
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(pc_value)
    assert spi.state.value == RECEIVE_DATA

    input = random.randint(0, 255)
    for i in range(8):
        spi.miso.value = (input >> (7 - i)) & 1
        await Timer(1)  # <= causes a slight delay, wait for it
        await ClockCycles(sclk, 1)
    # Wait for last value to be clocked in on the falling edge
    await ClockCycles(sclk, 1, False)
    await Timer(1)  # <= causes a slight delay, wait for it

    assert bin(spi.data.value.integer) == bin(input)
    assert spi.state.value == IDLE
