import cocotb
from cocotb.clock import Clock
from cocotb.triggers import Timer, RisingEdge, FallingEdge, ClockCycles

ROM = [
   0x70, 0x10, 0x71, 0x12, 0x5d, 0xb0, 0x30, 0x0,
]

class MicroMock(object):
     def __init__(self, **kwargs):
         self.__dict__.update(kwargs)

async def setup(dut):
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

async def send_rom_data(computer, sclk, _computer):
    read = 0
    for i in range(8):
        await RisingEdge(sclk)
        read |= computer.uio_out[1].value.integer << (7 - i)
    assert bin(read) == bin(0x03)

    pc = 0
    for i in range(16):
        await RisingEdge(sclk)
        pc |= computer.uio_out[1].value.integer << (15 - i)

    data = ROM[pc]
    for i in range(8):
        await FallingEdge(sclk)
        computer.uio_in[2].value = (data >> (7 - i)) & 1

    # TODO: Hmmm....
    await RisingEdge(_computer.spi_module.executing)

async def send_ram_data(computer, sclk):
    raise Exception("PANIC")
    # await ClockCycles(sclk, 8)

    # pc = 0
    # for i in range(16):
    #     pc |= computer.uio_out[1].value.integer << (15 - i)
    #     await ClockCycles(sclk, 1)
    #     await Timer(1)  # <= causes a slight delay, wait for it

    # data = ROM[pc]
    # for i in range(8):
    #     computer.uio_in[2].value = (data >> (7 - i)) & 1
    #     await ClockCycles(sclk, 1)
    #     await Timer(1)  # <= causes a slight delay, wait for it

@cocotb.test()
async def test_full(dut):
    computer, clk, sclk = await setup(dut)

    # Only for debugging
    _computer = dut.tt_um_aerox2_jrb8_computer

    for _ in range(100):
        # print("PC", _computer.pc.value.integer)
        # print("ROM[PC]", _computer.rom.value.integer)
        # print("INFLAGS", _computer.in_decoder.value)
        # print("OUTFLAGS", _computer.out_decoder.value)
        # print("ROMO", _computer.romo.value)
        # print("PCC", _computer.pcc.value)
        # print("ROMOT", _computer.romot.value)
        # print("A, B", 
        #     _computer.areg.value.integer,
        #     _computer.c_or_d_reg.value.integer,
        # )
        # print("ALUOUT, OVEROUT, CARRYOUT", 
        #     _computer.aluout.value.integer,
        #     _computer.overout.value.integer,
        #     _computer.carryout.value.integer,
        # )
        # print("Z O C S", 
        #     _computer.zflag.value.integer,
        #     _computer.oflag.value.integer,
        #     _computer.cflag.value.integer,
        #     _computer.sflag.value.integer,
        # )

        await ClockCycles(clk, 1)
        if (computer.uio_out[0] == 0):
            await send_rom_data(computer, sclk, _computer)
        # if (computer.uio_out[4] == 0):
        #     await send_ram_data(computer, sclk)

        

