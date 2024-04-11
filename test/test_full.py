import math
import glob
from pathlib import Path

import cocotb
from cocotb.clock import Clock
from cocotb.triggers import Timer, ClockCycles

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

    data = ROM[pc]
    print("Reading ROM from", pc, "which is", data)

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

        print("Written data is", data, "at", mar)
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


async def load_and_run(dut, path, steps):
    with open(path, "r") as f:
        program_d = f.readlines()
    program_b = [int(x, 16) for x in program_d[1].split()]

    return await run(dut, program_b, steps)


def string_to_dict(s):
    if not s:
        return {}
    pairs = [pair.strip().split(":") for pair in s.split(",")]
    result = {int(pair[0]): int(pair[1]) for pair in pairs}
    return result


@cocotb.test()
async def test_add_example(dut):
    outputs = await load_and_run(dut, "../example_programs/add_program.o", 100)
    assert outputs[1] == 34


@cocotb.test()
async def test_jmp_example(dut):
    outputs = await load_and_run(dut, "../example_programs/jmp_program.o", 300)
    assert outputs[1] == 6


@cocotb.test()
async def test_division_example(dut):
    outputs = await load_and_run(dut, "../example_programs/division_test.o", 2000)
    assert outputs[1] == 4
    assert outputs[2] == 7


@cocotb.test()
async def test_division_example_2(dut):
    outputs = await load_and_run(dut, "../example_programs/div_mult_test.o", 900)
    assert outputs[1] == 7
    assert outputs[2] == 115
    assert outputs[3] == 1


@cocotb.test()
async def test_ram_example(dut):
    outputs = await load_and_run(dut, "../example_programs/memory_test.o", 300)
    assert RAM[21] == 12
    assert RAM[43] == 34
    assert RAM[65] == 56
    assert outputs[1] == 34
    assert outputs[2] == 56


@cocotb.test()
async def test_large_numbers_example(dut):
    outputs = await load_and_run(dut, "../example_programs/large_numbers.o", 3000)
    a = 4567 + 1234
    assert outputs[1] == a & 0xFF
    assert outputs[2] == (a >> 8) & 0xFF

    a = 1234 * 5678
    assert outputs[3] == a & 0xFF
    assert outputs[4] == (a >> 8) & 0xFF
    assert outputs[5] == (a >> 16) & 0xFF


def is_perfect_square(n):
    root = int(math.sqrt(n))
    return root * root == n


def is_fibonacci(num):
    return is_perfect_square(5 * num * num + 4) or is_perfect_square(5 * num * num - 4)


@cocotb.test()
async def test_fibonacci_example(dut):
    outputs = await load_and_run(dut, "../example_programs/fibonacci.o", 500)
    assert len(outputs) > 1
    for output in outputs[1:]:
        assert is_fibonacci(output)


def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(math.sqrt(n)) + 1):
        if n % i == 0:
            return False
    return True


@cocotb.test()
async def test_primes_example(dut):
    outputs = await load_and_run(dut, "../example_programs/primes.o", 5000)
    assert len(outputs) > 2
    for output in outputs[2:]:
        assert is_prime(output.integer)


# # @cocotb.test()
# # async def test_all(dut):
# #     programs = glob.glob('../example_programs/*.e')
# #     for program in programs:
# #         print("Running program: ", program)
# #         path = Path(program)

# #         with open(path, "r") as f:
# #             expected_d = f.readlines()
# #         expected_steps = int(expected_d[0][2:])
# #         expected_output = list(map(int, expected_d[2][3:].strip().split(",")))
# #         expected_ram = string_to_dict(expected_d[3][3:].strip())

# #         outputs = await load_and_run(dut, path.with_suffix(".o"), expected_steps)

# #         for k,v in expected_ram.items():
# #             assert RAM[k] == v
# #         outputs = [x.integer for x in outputs]
# #         assert outputs[1:] == expected_output
