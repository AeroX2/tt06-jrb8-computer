import math
import cocotb
from cocotb.clock import Clock
from cocotb.triggers import Timer, RisingEdge, FallingEdge, ClockCycles, NextTimeStep
from cocotb.handle import NonHierarchyIndexableObject

ROM_ADD_EXAMPLE = [0xC0, 0x10, 0xC1, 0x12, 0x68, 0xF0, 0xFF]

ROM_JMP_EXAMPLE = [
    0x30,
    0x00,
    0x05,
    0xF0,
    0xFF,
    0xC0,
    0x01,
    0xC1,
    0x01,
    0x68,
    0x30,
    0x00,
    0x14,
    0x10,
    0xC0,
    0x0B,
    0x80,
    0x30,
    0x00,
    0x03,
    0xC1,
    0x03,
    0x68,
    0x30,
    0x00,
    0x0D,
]

ROM_DIVISION_EXAMPLE = [
    0xC0,
    0x35,
    0xC1,
    0x07,
    0xC2,
    0x00,
    0x80,
    0x37,
    0x00,
    0x12,
    0x17,
    0x61,
    0x14,
    0xC1,
    0x07,
    0x30,
    0x00,
    0x06,
    0x68,
    0xF0,
    0xF2,
    0xFF,
]

ROM_RAM_EXAMPLE = [
    0xC0,
    0x0C,
    0xDC,
    0x15,
    0xC0,
    0x22,
    0xDC,
    0x2B,
    0xC0,
    0x38,
    0xDC,
    0x41,
    0xC5,
    0x2B,
    0xC2,
    0x41,
    0xBA,
    0xF1,
    0xF2,
]

ROM_FIBONACCI_EXAMPLE = [
    0xC0,
    0x01,
    0xC1,
    0x00,
    0x11,
    0x68,
    0x34,
    0x00,
    0x00,
    0xF0,
    0x17,
    0x36,
    0x00,
    0x04,
    0xF0,
]

ROM_PRIMES_EXAMPLE = [
    0xC2,
    0x02,
    0xC1,
    0x02,
    0x16,
    0x80,
    0x31,
    0x00,
    0x15,
    0x39,
    0x00,
    0x05,
    0x61,
    0x26,
    0x36,
    0x00,
    0x14,
    0x30,
    0x00,
    0x04,
    0xF2,
    0x62,
    0x30,
    0x00,
    0x02,
]

RAM = [0xFF] * 65536


class MicroMock(object):
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


async def setup(dut):
    global RAM
    RAM = [0xFF] * 65536

    computer = dut.tt_um_aerox2_jrb8_computer
    clk = computer.clk
    sclk = computer.uio_out[3]

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    # Clock divider to 0
    computer.uio_in[5].value = 0
    computer.uio_in[6].value = 0

    computer.rst_n.value = 1
    await Timer(10, "us")
    computer.rst_n.value = 0
    await Timer(10, "us")
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


async def wait_for_sclk(sclk, v):
    q = sclk.value
    while q != v:
        q = sclk.value
        await Timer(5, "us")


async def send_rom_data(computer, sclk, ROM):
    read = 0
    for i in range(8):
        await wait_for_sclk(sclk, 1)
        read |= computer.uio_out[1].value.integer << (7 - i)
        await wait_for_sclk(sclk, 0)
    assert bin(read) == bin(0x3)

    pc = 0
    for i in range(16):
        await wait_for_sclk(sclk, 1)
        pc |= computer.uio_out[1].value.integer << (15 - i)
        await wait_for_sclk(sclk, 0)

    print("Reading ROM from", pc)

    data = ROM[pc]
    for i in range(8):
        await wait_for_sclk(sclk, 0)
        computer.uio_in[2].value = (data >> (7 - i)) & 1
        await wait_for_sclk(sclk, 1)
    await wait_for_sclk(sclk, 0)
    computer.uio_in[2].value = 0


async def send_ram_data(computer, sclk):
    read_or_write = 0
    for i in range(8):
        await wait_for_sclk(sclk, 1)
        read_or_write |= computer.uio_out[1].value.integer << (7 - i)
        await wait_for_sclk(sclk, 0)
    assert bin(read_or_write) == bin(0x2) or bin(read_or_write) == bin(0x3)

    mar = 0
    for i in range(16):
        await wait_for_sclk(sclk, 1)
        mar |= computer.uio_out[1].value.integer << (15 - i)
        await wait_for_sclk(sclk, 0)

    if read_or_write == 0x2:
        # Write
        data = 0
        for i in range(8):
            await wait_for_sclk(sclk, 1)
            data |= computer.uio_out[1].value.integer << (7 - i)
            await wait_for_sclk(sclk, 0)
        await wait_for_sclk(sclk, 0)

        print("Written data is", data)
        RAM[mar] = data
    else:
        # Read
        data = RAM[mar]
        print("Read data is", data)
        for i in range(8):
            await wait_for_sclk(sclk, 0)
            computer.uio_in[2].value = (data >> (7 - i)) & 1
            await wait_for_sclk(sclk, 1)
        await wait_for_sclk(sclk, 0)
        computer.uio_in[2].value = 0


async def run(dut, ROM, cycles):
    computer, clk, sclk = await setup(dut)

    # Only for debugging
    _computer = dut.tt_um_aerox2_jrb8_computer

    outputs = []
    for cycle in range(cycles):
        await ClockCycles(clk, 1)

        if computer.uo_out.value not in outputs:
            outputs.append(computer.uo_out.value)

        try:
            if computer.uio_out[0] == 0:
                await send_rom_data(computer, sclk, ROM)
            if computer.uio_out[4] == 0:
                await send_ram_data(computer, sclk)
        except Exception as e:
            print(e)
            print(f"Failure at cycle: {cycle}")
            print(f"PC was: {_computer.pc.value.integer}")
            print(RAM[:50])
            break
    return outputs


@cocotb.test()
async def test_add_example(dut):
    outputs = await run(dut, ROM_ADD_EXAMPLE, 100)
    assert outputs[1] == 34


@cocotb.test()
async def test_jmp_example(dut):
    outputs = await run(dut, ROM_JMP_EXAMPLE, 200)
    assert outputs[1] == 6


@cocotb.test()
async def test_division_example(dut):
    outputs = await run(dut, ROM_DIVISION_EXAMPLE, 900)
    assert outputs[1] == 4
    assert outputs[2] == 7


@cocotb.test()
async def test_ram_example(dut):
    outputs = await run(dut, ROM_RAM_EXAMPLE, 200)
    assert RAM[21] == 12
    assert RAM[43] == 34
    assert RAM[65] == 56
    print(outputs)
    assert outputs[1] == 34
    assert outputs[2] == 56


def is_perfect_square(n):
    root = int(math.sqrt(n))
    return root * root == n


def is_fibonacci(num):
    return is_perfect_square(5 * num * num + 4) or is_perfect_square(5 * num * num - 4)


@cocotb.test()
async def test_fibonacci_example(dut):
    outputs = await run(dut, ROM_FIBONACCI_EXAMPLE, 500)
    assert len(outputs) > 1
    for output in outputs[1:]:
        assert is_fibonacci(output)


def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(math.sqrt(n)) + 1):
        print("N", n, i, n % i)
        if n % i == 0:
            return False
    return True


@cocotb.test()
async def test_primes_example(dut):
    outputs = await run(dut, ROM_PRIMES_EXAMPLE, 5000)
    assert len(outputs) > 2
    for output in outputs[2:]:
        assert is_prime(output.integer)
