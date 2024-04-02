import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import Timer, ClockCycles
from cocotb.handle import Force


async def setup(dut):
    alu = dut.tt_um_aerox2_jrb8_computer.alu_module

    a = random.randint(-126, 126)
    b = random.randint(-126, 126)

    alu.a.value = a
    alu.b.value = b
    alu.oe.value = 1
    alu.cins.value = 0
    alu.carryin.value = 0

    alu.rst.value = 1
    await Timer(1)
    alu.rst.value = 0
    await Timer(1)

    return alu, a, b


@cocotb.test()
async def test_alu_sanity(dut):
    alu, a, b = await setup(dut)

    alu.a.value = 0
    alu.b.value = 0
    await Timer(1)

    assert alu.aluout.value.signed_integer == 0


@cocotb.test()
async def test_alu_consts(dut):
    alu, a, b = await setup(dut)

    alu.cins.value = 0x45
    await Timer(1)
    assert alu.aluout.value.signed_integer == 0

    alu.cins.value = 0x46
    await Timer(1)
    assert alu.aluout.value.signed_integer == 1

    alu.cins.value = 0x47
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
    alu, a, b = await setup(dut)

    await test(alu, [0x48, 0x49, 0x4a, 0x4b], [a, a, a, a])

    await test(alu, [0x4c, 0x4d, 0x4e, 0x4f], [~a, ~a, ~a, ~a])


@cocotb.test()
async def test_alu_additions(dut):
    alu, a, b = await setup(dut)

    await test(alu, [0x50, 0x51, 0x52, 0x53], [-a, -a, -a, -a])

    await test(alu, [0x54, 0x55, 0x56, 0x57], [a + 1, a + 1, a + 1, a + 1])

    await test(alu, [0x58, 0x59, 0x5a, 0x5b], [a - 1, a - 1, a - 1, a - 1])


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
    alu, a, b = await setup(dut)

    # Test without overflow
    a, b = gen_rand(lambda a, b: a + b > -127 and a + b < 127)
    alu.a.value = a
    alu.b.value = b

    await test(alu, [0x5c, 0x5d, 0x5e], [a + b, a + b, a + b])
    await test(alu, [0x5f, 0x60, 0x61], [b + a, b + a, b + a])
    await test(alu, [0x62, 0x63, 0x64], [b + a, b + a, b + a])
    await test(alu, [0x65, 0x66, 0x67], [b + a, b + a, b + a])

    # TODO Test a+b carry?

    await test(alu, [0x68, 0x69, 0x6a], [a - b, a - b, a - b])
    await test(alu, [0x6b, 0x6c, 0x6d], [a - b, a - b, a - b])
    await test(alu, [0x6e, 0x6f, 0x70], [a - b, a - b, a - b])
    await test(alu, [0x71, 0x72, 0x73], [a - b, a - b, a - b])


def assert_(cond):
    assert cond


@cocotb.test()
async def test_alu_additions_overflows(dut):
    alu, a, b = await setup(dut)

    # a+1
    alu.a.value = 127
    await test(
        alu,
        [0x54, 0x55, 0x56, 0x57],
        [-128, -128, -128, -128],
        True,
        lambda alu: assert_(alu.carryout.value == 1),
    )

    # a-1
    alu.a.value = -127
    await test(
        alu,
        [0x58, 0x59, 0x5a, 0x5b],
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
    alu, a, b = await setup(dut)

    # TODO Test signed mode?

    a = random.randint(1, 15)
    alu.a.value = a
    b = random.randint(1, 15)
    alu.b.value = b
    v = (a * b) & 0xFF
    await test(alu, [0x74, 0x75, 0x76, 0x77], [v, v, v, v], False)
    await test(alu, [0x78, 0x79, 0x7a, 0x7b], [v, v, v, v], False)
    await test(alu, [0x7c, 0x7d, 0x7e, 0x7f], [v, v, v, v], False)
    await test(alu, [0x80, 0x81, 0x82, 0x83], [v, v, v, v], False)

    a = random.randint(1, 15)
    alu.a.value = a
    b = random.randint(1, 7)
    alu.b.value = b
    v = (a * b) >> 16
    await test(alu, [0x84, 0x85, 0x86, 0x87], [v, v, v, v], False)
    await test(alu, [0x88, 0x89, 0x8a, 0x8b], [v, v, v, v], False)
    await test(alu, [0x8c, 0x8d, 0x8e, 0x8f], [v, v, v, v], False)
    await test(alu, [0x90, 0x91, 0x92, 0x93], [v, v, v, v], False)

    a = random.randint(1, 255)
    alu.a.value = a
    b = random.randint(1, 255)
    alu.b.value = b
    v = a // b
    await test(alu, [0x94, 0x95, 0x96], [v, v, v], False)
    await test(alu, [0x97, 0x98, 0x99], [v, v, v], False)
    await test(alu, [0x9a, 0x9b, 0x9c], [v, v, v], False)
    await test(alu, [0x9d, 0x9e, 0x9f], [v, v, v], False)


@cocotb.test()
async def test_alu_extra(dut):
    alu, a, b = await setup(dut)

    v = (a & 0xFF) & (b & 0xFF)
    await test(alu, [0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5], [v, v, v, v, v, v], False)

    v = (a & 0xFF) | (b & 0xFF)
    await test(alu, [0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xab], [v, v, v, v, v, v], False)

