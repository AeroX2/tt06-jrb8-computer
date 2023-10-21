import cocotb
import random
from cocotb.clock import Clock
from cocotb.triggers import RisingEdge, FallingEdge, Timer, ClockCycles

def setup(dut):
    alu = dut.tt_um_jrb8_computer.alu

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

@cocotb.test()
async def test_alu_simple(dut):
    alu, a, b = setup(dut)
    
    alu.cins.value = 0x53
    await Timer(1)
    assert alu.aluout.value.signed_integer == a

    alu.cins.value = 0x54
    await Timer(1)
    assert alu.aluout.value.signed_integer == b

    alu.cins.value = 0x55
    await Timer(1)
    assert alu.aluout.value.signed_integer == ~a

    alu.cins.value = 0x56
    await Timer(1)
    assert alu.aluout.value.signed_integer == ~b

@cocotb.test()
async def test_alu_additions(dut):
    alu, a, b = setup(dut)

    alu.cins.value = 0x57
    await Timer(1)
    assert alu.aluout.value.signed_integer == -a

    alu.cins.value = 0x58
    await Timer(1)
    assert alu.aluout.value.signed_integer == -b

    alu.cins.value = 0x59
    await Timer(1)
    assert alu.aluout.value.signed_integer == a+1

    alu.cins.value = 0x5a
    await Timer(1)
    assert alu.aluout.value.signed_integer == b+1

    alu.cins.value = 0x5b
    await Timer(1)
    assert alu.aluout.value.signed_integer == a-1

    alu.cins.value = 0x5c
    await Timer(1)
    assert alu.aluout.value.signed_integer == b-1

def gen_rand(cond):
    test = True
    while (test):
        a = random.randint(-127, 127)
        b = random.randint(-127, 127)
        if (cond(a,b)):
            test = False
    return a,b

@cocotb.test()
async def test_alu_additions_2(dut):
    alu, a, b = setup(dut)

    # Test without overflow
    a, b = gen_rand(lambda a,b: a+b > -127 and a+b < 127) 

    alu.a.value = a
    alu.b.value = b

    alu.cins.value = 0x5d
    await Timer(1)
    assert alu.aluout.value.signed_integer == a+b

    a, b = gen_rand(lambda a,b: a-b > -127 and a-b < 127) 
    alu.a.value = a
    alu.b.value = b

    alu.cins.value = 0x5e
    await Timer(1)
    assert alu.aluout.value.signed_integer == a-b

    a, b = gen_rand(lambda a,b: b-a > -127 and b-a < 127) 
    alu.a.value = a
    alu.b.value = b

    alu.cins.value = 0x5f
    await Timer(1)
    assert alu.aluout.value.signed_integer == b-a


@cocotb.test()
async def test_alu_additions_overflows(dut):
    alu, a, b = setup(dut)

    # a+1
    alu.a.value = 127
    alu.cins.value = 0x59
    await Timer(1)
    assert alu.carryout.value == 1
    assert alu.aluout.value.signed_integer == -128

    # b+1
    alu.b.value = 127
    alu.cins.value = 0x5a
    await Timer(1)
    assert alu.carryout.value == 1
    assert alu.aluout.value.signed_integer == -128

    # a-1
    alu.a.value = -127
    alu.cins.value = 0x5b
    await Timer(1)
    assert alu.carryout.value == 1
    assert alu.aluout.value.signed_integer == -128

    # b-1
    alu.b.value = -127
    alu.cins.value = 0x5c
    await Timer(1)
    assert alu.carryout.value == 1
    assert alu.aluout.value.signed_integer == -128

    # Test with overflow
    #a, b = gen_rand(lambda a,b: a+b > 127) 
    #alu.a.value = a
    #alu.b.value = b

    #alu.cins.value = 0x5d
    #await Timer(1)
    #assert alu.overout.value == 1
    #assert alu.aluout.value.signed_integer == (a+b) & 0xFF

    #a, b = gen_rand(lambda a,b: a-b < 0) 
    #alu.a.value = a
    #alu.b.value = b

    #alu.cins.value = 0x5e
    #await Timer(1)
    #assert alu.carryout.value == 1
    #assert alu.aluout.value.signed_integer == (a-b) & 0xFF

    #a, b = gen_rand(lambda a,b: b-a < 0) 
    #alu.a.value = a
    #alu.b.value = b

    #alu.cins.value = 0x5f
    #await Timer(1)
    #assert alu.carryout.value == 1
    #assert alu.aluout.value.signed_integer == (b-a) & 0xFF

@cocotb.test()
async def test_alu_extra(dut):
    alu, a, b = setup(dut)

    alu.cins.value = 0x60
    await Timer(1)
    assert alu.aluout.value == (a & 0xFF) & (b & 0xFF)

    # assert -13 == ((-29 & 255) | (17 & 255))
    alu.cins.value = 0x61
    await Timer(1)
    assert alu.aluout.value == (a & 0xFF) | (b & 0xFF)

    a, b = gen_rand(lambda a,b: a+b+1 < 127 and a+b+1 > -127) 
    alu.a.value = a
    alu.b.value = b
    alu.cins.value = 0x62
    alu.carryin.value = 1
    await Timer(1)
    assert alu.aluout.value.signed_integer == a+b+1

    b = random.randint(1, 7)
    alu.b.value = b
    alu.cins.value = 0x63
    await Timer(1)
    assert alu.aluout.value.integer == ((a & 0xFF) >> (b & 0xFF)) & 0xFF

    b = random.randint(1, 7)
    alu.b.value = b
    alu.cins.value = 0x64
    await Timer(1)
    assert alu.aluout.value.integer == ((a & 0xFF) << (b & 0xFF)) & 0xFF
