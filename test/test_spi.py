import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import Timer, RisingEdge, FallingEdge, ClockCycles
from cocotb.handle import Force

IDLE = 0
SEND_COMMAND = 1
SEND_ADDRESS = 2
SEND_DATA = 3
RECEIVE_DATA = 4


async def setup(dut):
    spi = dut.tt_um_aerox2_jrb8_computer.spi_module
    clk = spi.clk

    spi.start.value = Force(0)
    spi.address_24bit.value = Force(0)
    spi.address.value = 0
    spi.write.value = 0

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    spi.rst.value = 1
    await Timer(1)
    spi.rst.value = 0
    await Timer(1)

    return spi, clk


@cocotb.test()
async def test_serial_rom_out(dut):
    spi, clk = await setup(dut)

    await ClockCycles(clk, 100)  # We should be able to wait here forever until ready
    assert spi.spi_state.value == IDLE
    assert spi.cs.value == 1
    assert spi.mosi.value == 0

    pc_value = random.randint(0, 65535)
    spi.address.value = Force(pc_value)
    await ClockCycles(clk, 100)

    spi.start.value = Force(1)
    await ClockCycles(clk, 1)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.spi_state.value == SEND_COMMAND
    assert spi.cs.value == 0
    assert spi.mosi.value == 0
    assert spi.done.value == 0
    spi.start.value = Force(0)

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x03  # SPI Read command is 0x03

    await FallingEdge(spi.sclk)
    assert spi.spi_next_state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(pc_value)

    await FallingEdge(spi.sclk)
    assert spi.spi_next_state.value == RECEIVE_DATA

    input = random.randint(0, 255)
    for i in range(8):
        await RisingEdge(spi.sclk)
        spi.miso.value = (input >> (7 - i)) & 1

    await RisingEdge(spi.done)
    assert bin(spi.data.value.integer) == bin(input)

    # Make sure SPI isn't triggering multiple times.
    await ClockCycles(clk, 100)
    assert spi.spi_state.value == IDLE


@cocotb.test()
async def test_serial_ram_out(dut):
    spi, clk = await setup(dut)

    mar_value = random.randint(0, 65535)
    spi.address.value = Force(mar_value)
    await ClockCycles(clk, 100)  # We should be able to wait here forever until ready
    assert spi.spi_state.value == IDLE
    assert spi.cs.value == 1
    assert spi.mosi.value == 0

    spi.start.value = Force(1)
    await ClockCycles(clk, 1)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.spi_state.value == SEND_COMMAND
    assert spi.cs.value == 0
    assert spi.mosi.value == 0
    assert spi.done.value == 0
    spi.start.value = Force(0)

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x03  # SPI Read command is 0x03

    await FallingEdge(spi.sclk)
    assert spi.spi_next_state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(mar_value)

    await FallingEdge(spi.sclk)
    assert spi.spi_next_state.value == RECEIVE_DATA

    input = random.randint(0, 255)
    for i in range(8):
        await RisingEdge(spi.sclk)
        spi.miso.value = (input >> (7 - i)) & 1

    await RisingEdge(spi.done)
    assert bin(spi.data.value.integer) == bin(input)

    # Make sure SPI isn't triggering multiple times.
    await ClockCycles(clk, 100)
    assert spi.spi_state.value == IDLE


@cocotb.test()
async def test_serial_ram_in(dut):
    spi, clk = await setup(dut)

    mar_value = random.randint(0, 65535)
    spi.address.value = Force(mar_value)

    databus_value = random.randint(0, 255)
    spi.databus.value = Force(databus_value)
    await ClockCycles(clk, 100)  # We should be able to wait here forever until ready
    assert spi.spi_state.value == IDLE
    assert spi.cs.value == 1
    assert spi.mosi.value == 0

    spi.start.value = Force(1)
    spi.write.value = Force(1)
    await ClockCycles(clk, 1)
    await Timer(1)
    assert spi.spi_state.value == SEND_COMMAND
    assert spi.cs.value == 0
    assert spi.mosi.value == 0
    assert spi.done.value == 0
    spi.start.value = Force(0)

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x02  # SPI Write command is 0x02

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.spi_next_state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(mar_value)

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.spi_next_state.value == SEND_DATA

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)

    await RisingEdge(spi.done)
    assert bin(output) == bin(databus_value)

    await ClockCycles(clk, 100)
    assert spi.spi_state.value == IDLE
