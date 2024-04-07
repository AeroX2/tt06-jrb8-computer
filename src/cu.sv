module cu (
    input clk,
    input rst,
    input halt,

    input spi_done,
    output logic spi_executing,

    input alu_done,
    output logic alu_executing,

    input [7:0] irin,

    input pcinflag,
    input [15:0] pcin,
    output logic [15:0] pc,
    output logic highbits_we,

    output logic [21:0] flags,
    output logic [21:0] flags_noc,
    output logic [ 7:0] cuout
);
  logic [7:0] cu_rom[0:255];
  logic [7:0] cu_rom_2[0:255];
  logic [21:0] cu_flag_conv[0:80];
  initial begin
    $readmemh("../rom/cu_rom.mem", cu_rom);
    $readmemh("../rom/cu_rom_2.mem", cu_rom_2);
    $readmemh("../rom/cu_flag_conv.mem", cu_flag_conv);
  end

  // States
  typedef enum {
    UPDATE_SPI,
    UPDATE_IR,
    FLAGS_1,
    FLAGS_1_ALU,
    FLAGS_1_SPI,
    FLAGS_1_EVENTS,
    FLAGS_2,
    FLAGS_2_ALU,
    FLAGS_2_SPI,
    FLAGS_2_EVENTS
  } State;

  State cu_state, cu_next_state;

  logic [7:0] ir_reg;
  logic [15:0] pc_reg;

  // PCC, RAMI, ROMO, RAMO
  wire pcc = flags_noc[20];
  wire rom_or_ram_state_change = pcc ||
						flags_noc[13] || 
						flags_noc[9] ||
						flags_noc[10];

  wire aluo = flags_noc[1] ||
		flags_noc[2] ||
		flags_noc[3] ||
		flags_noc[4];

  logic spi_done_reg;
  logic alu_done_reg;

  always_ff @(posedge clk, posedge rst) begin
    if (rst) begin
      pc_reg <= 0;
      cu_state <= UPDATE_SPI;

      spi_done_reg <= 1;
      alu_done_reg <= 1;
    end else if (!halt) begin
      cu_state <= cu_next_state;

      spi_done_reg <= spi_done;
      alu_done_reg <= alu_done;

      case (cu_state)
        FLAGS_1, FLAGS_2: begin
          // If PCC is set, count the clock.
          if (pcc) pc_reg <= pc_reg + 1;
        end
        FLAGS_2_EVENTS: begin
          if (pcinflag) pc_reg <= pcin;
          else pc_reg <= pc_reg + 1;
        end
      endcase
    end
  end

  always_comb begin
    spi_executing = 0;
    alu_executing = 0;

    ir_reg = irin;
    cu_next_state = UPDATE_SPI;

    case (cu_state)
      UPDATE_SPI: begin
        spi_executing = spi_done_reg;
        cu_next_state = State'(spi_done && !spi_done_reg ? UPDATE_IR : UPDATE_SPI);
      end
      UPDATE_IR: begin
        cu_next_state = FLAGS_1;
      end
      FLAGS_1: begin
        cu_next_state = State'(aluo ? FLAGS_1_ALU : (rom_or_ram_state_change ? FLAGS_1_SPI : FLAGS_1_EVENTS));
      end
      FLAGS_1_ALU: begin
        alu_executing = alu_done_reg;
        cu_next_state = State'(alu_done && !alu_done_reg ? FLAGS_1_ALU : (
              rom_or_ram_state_change ? FLAGS_1_SPI : FLAGS_1_EVENTS
            ));
      end
      FLAGS_1_SPI: begin
        spi_executing = spi_done_reg;
        cu_next_state = State'(spi_done && !spi_done_reg ? FLAGS_1_EVENTS : FLAGS_1_SPI);
      end
      FLAGS_1_EVENTS: begin
        cu_next_state = FLAGS_2;
      end
      FLAGS_2: begin
        cu_next_state = State'(aluo ? FLAGS_2_ALU : (rom_or_ram_state_change ? FLAGS_2_SPI : FLAGS_2_EVENTS));
      end
      FLAGS_2_ALU: begin
        alu_executing = alu_done_reg;
        cu_next_state = State'(alu_done && !alu_done_reg ? FLAGS_2_ALU : (
              rom_or_ram_state_change ? FLAGS_2_SPI : FLAGS_2_EVENTS
            ));
      end
      FLAGS_2_SPI: begin
        spi_executing = spi_done_reg;
        cu_next_state = State'(spi_done && !spi_done_reg ? FLAGS_2_EVENTS : FLAGS_2_SPI);
      end
      FLAGS_2_EVENTS: begin
        cu_next_state = UPDATE_SPI;
      end
    endcase
  end

  always_comb begin
    case (cu_state)
      // Turn on PCC and ROMO
      UPDATE_SPI, UPDATE_IR: begin
        flags_noc = 'b100000000001000000000;
      end
      FLAGS_1, FLAGS_1_ALU, FLAGS_1_SPI, FLAGS_1_EVENTS: begin
        flags_noc = cu_flag_conv[cu_rom[ir_reg]];
      end
      FLAGS_2, FLAGS_2_ALU, FLAGS_2_SPI, FLAGS_2_EVENTS: begin
        flags_noc = cu_flag_conv[cu_rom_2[ir_reg]];
      end

      default: flags_noc = 0;
    endcase

    case (cu_state)
      UPDATE_SPI, UPDATE_IR, FLAGS_1_EVENTS, FLAGS_2_EVENTS: begin
        flags = flags_noc;
      end

      default: flags = 0;
    endcase
  end

  assign pc = pc_reg;
  assign highbits_we = cu_state == FLAGS_1_EVENTS;
  assign cuout = ir_reg;
endmodule
