import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import Timer, RisingEdge, FallingEdge, ClockCycles

IDLE = 0
SEND_COMMAND = 1
SEND_ADDRESS = 2
SEND_DATA    = 3
RECEIVE_DATA = 4

async def setup(dut):
    spi = dut.tt_um_aerox2_jrb8_computer.spi_module
    clk = spi.clk

    spi.romo.value = 0
    spi.ramo.value = 0
    spi.rami.value = 0

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

    pc_value = random.randint(0, 65535)
    spi.pc.value = pc_value
    await ClockCycles(clk, 100)  # We should be able to wait here forever until ready
    assert spi.state.value == IDLE
    assert spi.cs_rom.value == 1
    assert spi.cs_ram.value == 1
    assert spi.mosi.value == 0

    spi.romo.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_COMMAND
    assert spi.cs_rom.value == 0
    assert spi.cs_ram.value == 1
    assert spi.mosi.value == 0

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x03 #SPI Read command is 0x03

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(pc_value)

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == RECEIVE_DATA

    input = random.randint(0, 255)
    for i in range(8):
        await RisingEdge(spi.sclk)
        spi.miso.value = (input >> (7 - i)) & 1

    await RisingEdge(spi.cs_rom)
    assert bin(spi.rom.value.integer) == bin(input)

    # Make sure SPI isn't triggering multiple times.
    await ClockCycles(clk, 100)
    assert spi.state.value == IDLE

@cocotb.test()
async def test_serial_ram_out(dut):
    spi, clk = await setup(dut)

    mar_value = random.randint(0, 65535)
    spi.mar.value = mar_value
    await ClockCycles(clk, 100)  # We should be able to wait here forever until ready
    assert spi.state.value == IDLE
    assert spi.cs_rom.value == 1
    assert spi.cs_ram.value == 1
    assert spi.mosi.value == 0

    spi.ramo.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_COMMAND
    assert spi.cs_rom.value == 1
    assert spi.cs_ram.value == 0
    assert spi.mosi.value == 0

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x03 #SPI Read command is 0x03

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(mar_value)

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == RECEIVE_DATA

    input = random.randint(0, 255)
    for i in range(8):
        await RisingEdge(spi.sclk)
        spi.miso.value = (input >> (7 - i)) & 1

    await RisingEdge(spi.cs_ram)
    assert bin(spi.ram.value.integer) == bin(input)

    # Make sure SPI isn't triggering multiple times.
    await ClockCycles(clk, 100)
    assert spi.state.value == IDLE

@cocotb.test()
async def test_serial_ram_in(dut):
    spi, clk = await setup(dut)

    mar_value = random.randint(0, 65535)
    spi.mar.value = mar_value

    databus_value = random.randint(0, 255)
    spi.databus.value = databus_value
    await ClockCycles(clk, 100)  # We should be able to wait here forever until ready
    assert spi.state.value == IDLE
    assert spi.cs_rom.value == 1
    assert spi.cs_ram.value == 1
    assert spi.mosi.value == 0

    spi.rami.value = 1
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_COMMAND
    assert spi.cs_rom.value == 1
    assert spi.cs_ram.value == 0
    assert spi.mosi.value == 0

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)
    assert output == 0x02 #SPI Write command is 0x02

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_ADDRESS

    output = 0
    for i in range(16):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (15 - i)
    assert bin(output) == bin(mar_value)

    await FallingEdge(spi.sclk)
    await Timer(1)  # `<=` causes a slight delay, wait for it
    assert spi.state.value == SEND_DATA

    output = 0
    for i in range(8):
        await RisingEdge(spi.sclk)
        output |= spi.mosi.value.integer << (7 - i)

    await RisingEdge(spi.cs_ram)
    assert bin(output) == bin(databus_value)

    await ClockCycles(clk, 100)
    assert spi.state.value == IDLE
