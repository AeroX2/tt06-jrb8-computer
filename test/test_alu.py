import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import Timer, ClockCycles, RisingEdge
from cocotb.handle import Force

# TODO: Fine tune this
ALU_CYCLES = 5


async def setup(dut):
    alu = dut.tt_um_aerox2_jrb8_computer.alu_module
    clk = alu.clk

    clock = Clock(clk, 10, units="us")
    cocotb.start_soon(clock.start())

    a = random.randint(-126, 126)
    b = random.randint(-126, 126)

    alu.a.value = Force(a)
    alu.b.value = Force(b)
    alu.oe.value = Force(1)
    alu.cins.value = Force(0)
    alu.carryin.value = Force(0)

    alu.rst.value = 1
    await Timer(1)
    alu.rst.value = 0
    await Timer(1)

    return alu, clk, a, b


@cocotb.test()
async def test_alu_sanity(dut):
    alu, clk, a, b = await setup(dut)

    alu.a.value = Force(0)
    alu.b.value = Force(0)
    await ClockCycles(clk, ALU_CYCLES)

    assert alu.aluout.value.signed_integer == 0


@cocotb.test()
async def test_alu_consts(dut):
    alu, clk, a, b = await setup(dut)

    alu.cins.value = Force(0x55)
    alu.start.value = Force(1)
    await ClockCycles(clk, 1)
    alu.start.value = Force(0)
    await RisingEdge(alu.done)
    assert alu.aluout.value.signed_integer == 0

    alu.cins.value = Force(0x56)
    alu.start.value = Force(1)
    await ClockCycles(clk, 1)
    alu.start.value = Force(0)
    await RisingEdge(alu.done)
    assert alu.aluout.value.signed_integer == 1

    alu.cins.value = Force(0x57)
    alu.start.value = Force(1)
    await ClockCycles(clk, 1)
    alu.start.value = Force(0)
    await RisingEdge(alu.done)
    assert alu.aluout.value.signed_integer == -1


async def test(alu, clk, cins, expected_vals, signed=True, extra_f=None):
    for v in enumerate(cins):
        alu.cins.value = Force(v[1])
        alu.start.value = Force(1)
        await ClockCycles(clk, 1)
        alu.start.value = Force(0)

        await RisingEdge(alu.done)
        if signed:
            assert alu.aluout.value.signed_integer == expected_vals[v[0]]
        else:
            assert alu.aluout.value.integer == expected_vals[v[0]]
        if extra_f is not None:
            extra_f(alu)


@cocotb.test()
async def test_alu_simple(dut):
    alu, clk, a, b = await setup(dut)

    await test(alu, clk, [0x58, 0x59, 0x5A, 0x5B], [a, a, a, a])

    await test(alu, clk, [0x5C, 0x5D, 0x5E, 0x5F], [~a, ~a, ~a, ~a])

    await test(alu, clk, [0x60, 0x61, 0x62, 0x63], [-a, -a, -a, -a])


@cocotb.test()
async def test_alu_additions(dut):
    alu, clk, a, b = await setup(dut)

    await test(alu, clk, [0x64, 0x65, 0x66, 0x67], [a + 1, a + 1, a + 1, a + 1])

    await test(alu, clk, [0x68, 0x69, 0x6A, 0x6B], [a - 1, a - 1, a - 1, a - 1])


def gen_rand(cond):
    test = True
    while test:
        a = random.randint(-127, 127)
        b = random.randint(-127, 127)
        if cond(a, b):
            test = False
    return a, b


@cocotb.test()
async def test_alu_additions_2(dut):
    alu, clk, a, b = await setup(dut)

    # Test without overflow
    a, b = gen_rand(lambda a, b: a + b >= -128 and a + b <= 127)
    alu.a.value = Force(a)
    alu.b.value = Force(b)

    await test(alu, clk, [0x6C, 0x6D, 0x6E], [a + b, a + b, a + b])
    await test(alu, clk, [0x6F, 0x70, 0x71], [b + a, b + a, b + a])
    await test(alu, clk, [0x72, 0x73, 0x74], [b + a, b + a, b + a])
    await test(alu, clk, [0x75, 0x76, 0x77], [b + a, b + a, b + a])

    a, b = gen_rand(lambda a, b: a - b >= -128 and a - b <= 127)
    alu.a.value = Force(a)
    alu.b.value = Force(b)

    await test(alu, clk, [0x78, 0x79, 0x7A], [a - b, a - b, a - b])
    await test(alu, clk, [0x7B, 0x7C, 0x7D], [a - b, a - b, a - b])
    await test(alu, clk, [0x7E, 0x7F, 0x80], [a - b, a - b, a - b])
    await test(alu, clk, [0x81, 0x82, 0x83], [a - b, a - b, a - b])


def assert_(cond):
    assert cond


@cocotb.test()
async def test_alu_additions_overflows(dut):
    alu, clk, a, b = await setup(dut)

    # a+1
    alu.a.value = Force(127)
    await test(
        alu,
        clk,
        [0x64, 0x65, 0x66, 0x67],
        [-128, -128, -128, -128],
        True,
        lambda alu: assert_(alu.carryout.value == 1),
    )

    # a-1
    alu.a.value = Force(-127)
    await test(
        alu,
        clk,
        [0x68, 0x69, 0x6A, 0x6B],
        [-128, -128, -128, -128],
        True,
        lambda alu: assert_(alu.carryout.value == 1),
    )

    # TODO Test a+b overflow?

    # Test with overflow
    # a, b = gen_rand(lambda a,b: a+b > 127)
    # alu.a.value = a
    # alu.b.value = b

    # alu.cins.value = 0x5d
    # await Timer(1)
    # assert alu.overout.value == 1
    # assert alu.aluout.value.signed_integer == (a+b) & 0xFF

    # a, b = gen_rand(lambda a,b: a-b < 0)
    # alu.a.value = a
    # alu.b.value = b

    # alu.cins.value = 0x5e
    # await Timer(1)
    # assert alu.carryout.value == 1
    # assert alu.aluout.value.signed_integer == (a-b) & 0xFF

    # a, b = gen_rand(lambda a,b: b-a < 0)
    # alu.a.value = a
    # alu.b.value = b

    # alu.cins.value = 0x5f
    # await Timer(1)
    # assert alu.carryout.value == 1
    # assert alu.aluout.value.signed_integer == (b-a) & 0xFF


@cocotb.test()
async def test_alu_mult_div(dut):
    alu, clk, a, b = await setup(dut)

    # TODO Test signed mode?

    a = random.randint(1, 15)
    alu.a.value = Force(a)
    b = random.randint(1, 15)
    alu.b.value = Force(b)
    v = (a * b) & 0xFF
    await test(alu, clk, [0x84, 0x85, 0x86, 0x87], [v, v, v, v], False)
    await test(alu, clk, [0x88, 0x89, 0x8A, 0x8B], [v, v, v, v], False)
    await test(alu, clk, [0x8C, 0x8D, 0x8E, 0x8F], [v, v, v, v], False)
    await test(alu, clk, [0x90, 0x91, 0x92, 0x93], [v, v, v, v], False)

    a = random.randint(1, 15)
    alu.a.value = Force(a)
    b = random.randint(1, 7)
    alu.b.value = Force(b)
    v = (a * b) >> 16
    await test(alu, clk, [0x94, 0x95, 0x96, 0x97], [v, v, v, v], False)
    await test(alu, clk, [0x98, 0x99, 0x9A, 0x9B], [v, v, v, v], False)
    await test(alu, clk, [0x9C, 0x9D, 0x9E, 0x9F], [v, v, v, v], False)
    await test(alu, clk, [0xA0, 0xA1, 0xA2, 0xA3], [v, v, v, v], False)

    a = random.randint(1, 255)
    alu.a.value = Force(a)
    b = random.randint(1, 255)
    alu.b.value = Force(b)
    v = a // b
    await test(alu, clk, [0xA4, 0xA5, 0xA6], [v, v, v], False)
    await test(alu, clk, [0xA7, 0xA8, 0xA9], [v, v, v], False)
    await test(alu, clk, [0xAA, 0xAB, 0xAC], [v, v, v], False)
    await test(alu, clk, [0xAD, 0xAE, 0xAF], [v, v, v], False)


@cocotb.test()
async def test_alu_extra(dut):
    alu, clk, a, b = await setup(dut)

    v = (a & 0xFF) & (b & 0xFF)
    await test(
        alu, clk, [0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5], [v, v, v, v, v, v], False
    )

    v = (a & 0xFF) | (b & 0xFF)
    await test(
        alu, clk, [0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xBB], [v, v, v, v, v, v], False
    )
