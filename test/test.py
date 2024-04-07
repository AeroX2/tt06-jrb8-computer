from test_cmp import *
from test_alu import *
from test_jmp import *
from test_spi import *

if __name__ == "__main__":
    from cocotb_test.simulator import run
    from glob import glob

    sources = ["tb.v", *glob("../src/*.sv"), *glob("../src/*.v")]

    # run(
    #     verilog_sources=sources,
    #     toplevel="tb",
    #     module="test",
    #     work_dir="../src",
    # )

    run(
        verilog_sources=sources,
        toplevel="tb",
        module="test_full",
        work_dir="../src",
    )
