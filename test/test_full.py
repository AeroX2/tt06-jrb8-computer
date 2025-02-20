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


async def send_data(computer, sclk, ROM, address_24bit, cs_ram):
    read_or_write = 0
    for i in range(8):
        await wait_for_sclk(sclk, 1)
        read_or_write |= computer.uio_out[1].value.integer << (7 - i)
        await wait_for_sclk(sclk, 0)
    assert bin(read_or_write) == bin(0x2) or bin(read_or_write) == bin(0x3)

    address = 0
    v = 24 if address_24bit else 16
    for i in range(v):
        await wait_for_sclk(sclk, 1)
        address |= computer.uio_out[1].value.integer << (v - 1 - i)
        await wait_for_sclk(sclk, 0)

    if (address >= 0x10000 or cs_ram):
        address -= 0x10000
        if read_or_write == 0x2:
            # Write
            data = 0
            for i in range(8):
                await wait_for_sclk(sclk, 1)
                data |= computer.uio_out[1].value.integer << (7 - i)
                await wait_for_sclk(sclk, 0)
            await wait_for_sclk(sclk, 0)

            # print("Written data is", data, "at", address)
            RAM[address] = data
        else:
            # Read
            data = RAM[address]
            # print("Read data is", data)
            for i in range(8):
                await wait_for_sclk(sclk, 0)
                computer.uio_in[2].value = (data >> (7 - i)) & 1
                await wait_for_sclk(sclk, 1)
            await wait_for_sclk(sclk, 0)
            computer.uio_in[2].value = 0
    else:
        assert bin(read_or_write) == bin(0x03)
        data = ROM[address]
        # print("Reading ROM from", address, "which is", data)

        for i in range(8):
            await wait_for_sclk(sclk, 0)
            computer.uio_in[2].value = (data >> (7 - i)) & 1
            await wait_for_sclk(sclk, 1)
        await wait_for_sclk(sclk, 0)
        computer.uio_in[2].value = 0


async def run(dut, ROM, cycles, address_24bit = False, inputs = []):
    computer, clk, sclk = await setup(dut)

    # Only for debugging
    _computer = dut.tt_um_aerox2_jrb8_computer

    computer.uio_in[7].value = address_24bit

    outputs = []
    current_input = -1
    previous_output = None

    for cycle in range(cycles):
        await ClockCycles(clk, 1)

        current_output = computer.uo_out.value
        if current_output != previous_output:
            outputs.append(current_output)
            if (len(inputs) > 0):
                if current_input + 1 < len(inputs):
                    current_input += 1
                computer.ui_in.value = inputs[current_input]
        previous_output = current_output

        try:
            cs_rom = computer.uio_out[0] == 0
            cs_ram = computer.uio_out[4] == 0

            v = (cs_rom) if address_24bit else (cs_rom | cs_ram)
            if (v):
                await send_data(
                    computer,
                    sclk,
                    ROM,
                    address_24bit,
                    cs_ram and not address_24bit,
                )
        except Exception as e:
            print(e)
            print(f"Failure at cycle: {cycle}")
            print(f"PC was: {_computer.pc.value.integer}")
            print(RAM[:50])
            break
    return outputs


async def load_and_run(dut, path, steps, address_24bit=False, inputs = []):
    with open(path, "r") as f:
        program_d = f.readlines()
    program_b = [int(x, 16) for x in program_d[1].split()]

    return await run(dut, program_b, steps, address_24bit, inputs)


def string_to_dict(s):
    if not s:
        return {}
    pairs = [pair.strip().split(":") for pair in s.split(",")]
    result = {int(pair[0]): int(pair[1]) for pair in pairs}
    return result


@cocotb.test()
async def test_add_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/add_program.o", 200)
    assert outputs[1] == 34

    outputs = await load_and_run(dut, "../example_programs/assembly/add_program.o", 200, True)
    assert outputs[1] == 34


@cocotb.test()
async def test_output_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/output.o", 200)
    assert outputs[1] == 13
    assert outputs[2] == 37
    assert outputs[3] == 74

    outputs = await load_and_run(dut, "../example_programs/assembly/output.o", 200, True)
    assert outputs[1] == 13
    assert outputs[2] == 37
    assert outputs[3] == 74


@cocotb.test()
async def test_input_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/input_program.o", 500, False, [41,42,43])
    assert outputs[1] == -1 & 0xFF
    assert outputs[2] == 0
    assert outputs[3] == 1

    outputs = await load_and_run(dut, "../example_programs/assembly/input_program.o", 500, True, [41,42,43])
    assert outputs[1] == -1 & 0xFF
    assert outputs[2] == 0
    assert outputs[3] == 1


@cocotb.test()
async def test_jmp_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/jmp_program.o", 300)
    assert outputs[1] == 6

    outputs = await load_and_run(dut, "../example_programs/assembly/jmp_program.o", 300, True)
    assert outputs[1] == 6


@cocotb.test()
async def test_division_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/division_test.o", 2000)
    assert outputs[1] == 4
    assert outputs[2] == 7

    outputs = await load_and_run(dut, "../example_programs/assembly/division_test.o", 2000, True)
    assert outputs[1] == 4
    assert outputs[2] == 7


@cocotb.test()
async def test_division_example_2(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/div_mult_test.o", 900)
    assert outputs[1] == 7
    assert outputs[2] == 115
    assert outputs[3] == 1

    outputs = await load_and_run(dut, "../example_programs/assembly/div_mult_test.o", 900, True)
    assert outputs[1] == 7
    assert outputs[2] == 115
    assert outputs[3] == 1


@cocotb.test()
async def test_ram_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/memory_test.o", 300)
    assert RAM[21] == 12
    assert RAM[43] == 34
    assert RAM[65] == 56
    assert outputs[1] == 34
    assert outputs[2] == 56

    outputs = await load_and_run(dut, "../example_programs/assembly/memory_test.o", 300, True)
    assert RAM[21] == 12
    assert RAM[43] == 34
    assert RAM[65] == 56
    assert outputs[1] == 34
    assert outputs[2] == 56


@cocotb.test()
async def test_large_numbers_example(dut):
    outputs = await load_and_run(dut, "../example_programs/assembly/large_numbers.o", 3000)
    a = 4567 + 1234
    assert outputs[1] == a & 0xFF
    assert outputs[2] == (a >> 8) & 0xFF

    a = 1234 * 5678
    assert outputs[3] == a & 0xFF
    assert outputs[4] == (a >> 8) & 0xFF
    assert outputs[5] == (a >> 16) & 0xFF

    outputs = await load_and_run(dut, "../example_programs/assembly/large_numbers.o", 3000, True)
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
    outputs = await load_and_run(dut, "../example_programs/assembly/fibonacci.o", 500)
    assert len(outputs) > 1
    for output in outputs[1:]:
        assert is_fibonacci(output)

    outputs = await load_and_run(dut, "../example_programs/assembly/fibonacci.o", 500, True)
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
    outputs = await load_and_run(dut, "../example_programs/assembly/primes.o", 5000)
    assert len(outputs) > 2
    for output in outputs[2:]:
        assert is_prime(output.integer)

    outputs = await load_and_run(dut, "../example_programs/assembly/primes.o", 5000, True)
    assert len(outputs) > 2
    for output in outputs[2:]:
        assert is_prime(output.integer)
    outputs = await load_and_run(dut, "../example_programs/assembly/primes.o", 5000, True)
    assert len(outputs) > 2
    for output in outputs[2:]:
        assert is_prime(output.integer)
