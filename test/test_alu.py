import cocotb
import random
from cocotb.triggers import Timer
from cocotb.handle import Force


def setup(dut):
    alu = dut.tt_um_aerox2_jrb8_computer.alu_module

    a = random.randint(-126, 126)
    b = random.randint(-126, 126)

    alu.a.value = a
    alu.b.value = b
    alu.oe.value = 1
    alu.cins.value = 0
    alu.carryin.value = 0

    return alu, a, b


@cocotb.test()
async def test_alu_sanity(dut):
    alu, a, b = setup(dut)

    alu.a.value = 0
    alu.b.value = 0
    await Timer(1)

    assert alu.aluout.value.signed_integer == 0


@cocotb.test()
async def test_alu_consts(dut):
    alu, a, b = setup(dut)

    alu.cins.value = 0x50
    await Timer(1)
    assert alu.aluout.value.signed_integer == 0

    alu.cins.value = 0x51
    await Timer(1)
    assert alu.aluout.value.signed_integer == 1

    alu.cins.value = 0x52
    await Timer(1)
    assert alu.aluout.value.signed_integer == -1


async def test(alu, cins, expected_vals, signed=True, extra_f=None):
    for v in enumerate(cins):
        alu.cins.value = v[1]
        await Timer(1)
        if signed:
            assert alu.aluout.value.signed_integer == expected_vals[v[0]]
        else:
            assert alu.aluout.value.integer == expected_vals[v[0]]
        if extra_f is not None:
            extra_f(alu)


@cocotb.test()
async def test_alu_simple(dut):
    alu, a, b = setup(dut)

    await test(alu, [0x53, 0x54, 0x55, 0x56], [a, a, a, a])

    await test(alu, [0x57, 0x58, 0x59, 0x5A], [~a, ~a, ~a, ~a])


@cocotb.test()
async def test_alu_additions(dut):
    alu, a, b = setup(dut)

    await test(alu, [0x5B, 0x5C, 0x5D, 0x5E], [-a, -a, -a, -a])

    await test(alu, [0x60, 0x61, 0x62, 0x63], [a + 1, a + 1, a + 1, a + 1])

    await test(alu, [0x64, 0x65, 0x66, 0x67], [a - 1, a - 1, a - 1, a - 1])


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
    alu, a, b = setup(dut)

    # Test without overflow
    a, b = gen_rand(lambda a, b: a + b > -127 and a + b < 127)
    alu.a.value = a
    alu.b.value = b

    await test(alu, [0x68, 0x69, 0x6A], [a + b, a + b, a + b])
    await test(alu, [0x6B, 0x6C, 0x6D], [b + a, b + a, b + a])
    await test(alu, [0x6E, 0x6F, 0x70], [b + a, b + a, b + a])
    await test(alu, [0x71, 0x72, 0x73], [b + a, b + a, b + a])

    # TODO Test a+b carry?

    await test(alu, [0x80, 0x81, 0x82], [a - b, a - b, a - b])
    await test(alu, [0x83, 0x84, 0x85], [a - b, a - b, a - b])
    await test(alu, [0x86, 0x87, 0x88], [a - b, a - b, a - b])
    await test(alu, [0x89, 0x8A, 0x8B], [a - b, a - b, a - b])


def assert_(cond):
    assert cond


@cocotb.test()
async def test_alu_additions_overflows(dut):
    alu, a, b = setup(dut)

    # a+1
    alu.a.value = 127
    await test(
        alu,
        [0x60, 0x61, 0x62, 0x63],
        [-128, -128, -128, -128],
        True,
        lambda alu: assert_(alu.carryout.value == 1),
    )

    # a-1
    alu.a.value = -127
    await test(
        alu,
        [0x64, 0x65, 0x66, 0x67],
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
async def test_alu_extra(dut):
    alu, a, b = setup(dut)

    v = (a & 0xFF) & (b & 0xFF)
    await test(alu, [0x8C, 0x8D, 0x8E, 0x8F, 0x90, 0x91], [v, v, v, v, v, v], False)

    v = (a & 0xFF) | (b & 0xFF)
    await test(alu, [0x92, 0x93, 0x94, 0x95, 0x96, 0x97], [v, v, v, v, v, v], False)

    b = random.randint(1, 7)
    alu.b.value = b
    v = ((a & 0xFF) >> (b & 0xFF)) & 0xFF
    await test(alu, [0x98, 0x99, 0x9A], [v, v, v], False)
    await test(alu, [0x9B, 0x9C, 0x9D], [v, v, v], False)
    await test(alu, [0x9E, 0x9F, 0xA0], [v, v, v], False)
    await test(alu, [0xA1, 0xA2, 0xA3], [v, v, v], False)

    b = random.randint(1, 7)
    alu.b.value = b
    v = ((a & 0xFF) << (b & 0xFF)) & 0xFF
    await test(alu, [0xA4, 0xA5, 0xA6], [v, v, v], False)
    await test(alu, [0xA7, 0xA8, 0xA9], [v, v, v], False)
    await test(alu, [0xAA, 0xAB, 0xAC], [v, v, v], False)
    await test(alu, [0xAD, 0xAE, 0xAF], [v, v, v], False)
