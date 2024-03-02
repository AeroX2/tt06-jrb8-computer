import cocotb
from cocotb.clock import Clock
from cocotb.triggers import Timer, RisingEdge, FallingEdge, ClockCycles

ROM_ADD_EXAMPLE = [
    0x70, 0x10, 0x71, 0x12, 0x5d, 0xb0, 0xf0,
]

ROM_JMP_EXAMPLE = [
    0x30, 0x00, 0x04, 0xf0, 0x70, 0x01, 0x71, 0x01, 0x5d, 0x30, 0x00, 0x13, 0x10, 0x70, 0x0b, 0x5e, 0x30, 0x00, 0x03, 0x71, 0x03, 0x5d, 0x30, 0x00, 0x0c 
]

ROM_DIVISION_EXAMPLE = [
    0x70, 0x35, 0x71, 0x07, 0x72, 0x00, 0x5e, 0x37, 0x00, 0x12, 0x15, 0x5a, 0x13, 0x71, 0x07, 0x30, 0x00, 0x06, 0x15, 0x5a, 0x13, 0xf0, 
]

ROM_RAM_EXAMPLE = [
    0x70, 0x0c, 0x96, 0x15, 0x70, 0x22, 0x96, 0x2b, 0x70, 0x38, 0x96, 0x41, 0x8a, 0x2b, 0x72, 0x41, 0x88, 0x0, 0x0
]

ROM_FIBONACCI_EXAMPLE = [
    0x70, 0x01, 0x71, 0x00, 0x11, 0x5d, 0x33, 0x00, 0x00, 0xb0, 0x15, 0x36, 0x00, 0x04, 0x0, 0x0
]

ROM_PRIMES_EXAMPLE = [
    0x72, 0x01, 0x71, 0x02, 0x14, 0x5e, 0x31, 0x00, 0x16, 0x39, 0x00, 0x05, 0x5a, 0x10, 0x22, 0x36, 0x00, 0x15, 0x30, 0x00, 0x04, 0xb2, 0x14, 0x59, 0x11, 0x30, 0x00, 0x02, 0x0, 0x0
]

RAM = [0xFF]*65536

class MicroMock(object):
     def __init__(self, **kwargs):
         self.__dict__.update(kwargs)

async def setup(dut):
    global RAM
    RAM = [0xFF]*65536

    computer = dut.tt_um_aerox2_jrb8_computer
    clk = computer.clk
    sclk = computer.spi_module.sclk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    # Clock divider to 0
    computer.uio_in[5].value = 0
    computer.uio_in[6].value = 0

    computer.rst_n.value = 1
    await Timer(10, 'us')
    computer.rst_n.value = 0
    await Timer(10, 'us')
    computer.rst_n.value = 1
    # await Timer(10, 'us')

    mock = MicroMock(
        ui_in=computer.ui_in,
        uo_out=computer.uo_out,
        uio_in=computer.uio_in,
        uio_out=computer.uio_out,
        uio_oe=computer.uio_oe,
        ena=computer.ena,
        rst_n=computer.rst_n,
    )

    return mock, clk, sclk

async def send_rom_data(computer, sclk, ROM):
    read = 0
    for i in range(8):
        await RisingEdge(sclk)
        read |= computer.uio_out[1].value.integer << (7 - i)
    assert bin(read) == bin(0x3)

    pc = 0
    for i in range(16):
        await RisingEdge(sclk)
        pc |= computer.uio_out[1].value.integer << (15 - i)

    print("Reading ROM from", pc)

    data = ROM[pc]
    for i in range(8):
        await FallingEdge(sclk)
        computer.uio_in[2].value = (data >> (7 - i)) & 1
    await FallingEdge(sclk)
    computer.uio_in[2].value = 0

async def send_ram_data(computer, sclk):
    read_or_write = 0
    for i in range(8):
        await RisingEdge(sclk)
        read_or_write |= computer.uio_out[1].value.integer << (7 - i)
    assert bin(read_or_write) == bin(0x2) or bin(read_or_write) == bin(0x3)

    mar = 0
    for i in range(16):
        await RisingEdge(sclk)
        mar |= computer.uio_out[1].value.integer << (15 - i)

    if (read_or_write == 0x2):
        # Write
        data = 0
        for i in range(8):
            await RisingEdge(sclk)
            data |= computer.uio_out[1].value.integer << (7 - i)
        await FallingEdge(sclk)

        print("Written data is", data)
        RAM[mar] = data
    else:
        # Read
        data = RAM[mar]
        print("Read data is", data)
        for i in range(8):
            await FallingEdge(sclk)
            computer.uio_in[2].value = (data >> (7 - i)) & 1
        await FallingEdge(sclk)
        computer.uio_in[2].value = 0

async def run(dut, ROM, cycles):
    computer, clk, sclk = await setup(dut)

    # Only for debugging
    _computer = dut.tt_um_aerox2_jrb8_computer

    for cycle in range(cycles):
        await ClockCycles(clk, 1)

        try:
            if (computer.uio_out[0] == 0):
                await send_rom_data(computer, sclk, ROM)
            if (computer.uio_out[4] == 0):
                await send_ram_data(computer, sclk)
        except Exception as e:
            print(e)
            print(f"Failure at cycle: {cycle}")
            print(f"PC was: {_computer.pc.value.integer}")
            print(RAM[:50])
            break

@cocotb.test()
async def test_add_example(dut):
    await run(dut, ROM_ADD_EXAMPLE, 100)
    assert dut.tt_um_aerox2_jrb8_computer.uo_out.value == 34

@cocotb.test()
async def test_jmp_example(dut):
    await run(dut, ROM_JMP_EXAMPLE, 100)
    assert dut.tt_um_aerox2_jrb8_computer.areg.value == 6

@cocotb.test()
async def test_division_example(dut):
    await run(dut, ROM_DIVISION_EXAMPLE, 900)
    assert dut.tt_um_aerox2_jrb8_computer.areg.value == 4
    assert dut.tt_um_aerox2_jrb8_computer.creg.value == 7

# @cocotb.test()
# async def test_ram_example(dut):
#     await run(dut, ROM_RAM_EXAMPLE, 100)
#     print(RAM[:70])
#     assert RAM[21] == 12
#     assert RAM[43] == 34
#     assert RAM[65] == 56
#     assert dut.tt_um_aerox2_jrb8_computer.breg.value == 34
#     assert dut.tt_um_aerox2_jrb8_computer.creg.value == 56

# @cocotb.test()
# async def test_fibonacci_example(dut):
#     await run(dut, ROM_FIBONACCI_EXAMPLE)

# @cocotb.test()
# async def test_primes_example(dut):
#     await run(dut, ROM_PRIMES_EXAMPLE)

        

