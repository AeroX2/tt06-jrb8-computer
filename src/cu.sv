module cu(
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
	output logic [7:0] cuout
);
	logic [7:0] cu_rom [0:255];
	logic [7:0] cu_rom_2 [0:255];
	logic [21:0] cu_flag_conv [0:255];
	initial begin
		$readmemh("../rom/cu_rom.mem", cu_rom);
		$readmemh("../rom/cu_rom_2.mem", cu_rom_2);
		$readmemh("../rom/cu_flag_conv.mem", cu_flag_conv);
	end

	// States
	localparam  UPDATE_SPI     = 0,
				UPDATE_IR      = 1,
				FLAGS_1        = 2,
				FLAGS_1_SPI    = 3,
				FLAGS_1_EVENTS = 4,
				FLAGS_2        = 5,
				FLAGS_2_SPI    = 6,
				FLAGS_2_EVENTS = 7;

	logic [3:0] cu_state;
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

	always_ff @(negedge clk, posedge rst) begin
		if (rst) begin
			pc_reg <= 0;
			ir_reg <= 0;
			cu_state <= 0;
			spi_executing <= 0;
		end else if (!halt) begin
			case (cu_state)
				UPDATE_SPI: begin
					spi_executing <= 1;
					if (spi_done) begin
						spi_executing <= 0;
						cu_state <= UPDATE_IR;
					end
				end
				UPDATE_IR: begin
					ir_reg <= irin;
					cu_state <= FLAGS_1;
				end
				FLAGS_1: begin
					// If PCC is set, count the clock.
					if (pcc) begin
						pc_reg <= pc_reg + 1;
					end

					if (rom_or_ram_state_change) begin
						if (aluo) begin
							alu_executing <= 1;
							if (alu_done) begin
								spi_executing <= 1;
								cu_state <= FLAGS_1_SPI;
							end
						end
					end else begin
						cu_state <= FLAGS_1_EVENTS;
					end
				end
				FLAGS_1_SPI: begin
					if (spi_done) begin
						spi_executing <= 0;
						cu_state <= FLAGS_1_EVENTS;
					end
				end
				FLAGS_1_EVENTS: begin
					cu_state <= FLAGS_2;
				end
				FLAGS_2: begin
					// If PCC is set, count the clock.
					if (pcc) begin
						pc_reg <= pc_reg + 1;
					end

					if (rom_or_ram_state_change) begin
						if (aluo) begin
							alu_executing <= 1;
							if (alu_done) begin
								spi_executing <= 1;
								cu_state <= FLAGS_2_SPI;
							end
						end
					end else begin
						cu_state <= FLAGS_2_EVENTS;
					end

				end
				FLAGS_2_SPI: begin
					if (spi_done) begin
						spi_executing <= 0;
						cu_state <= FLAGS_2_EVENTS;
					end
				end
				FLAGS_2_EVENTS: begin
					if (pcinflag) begin
						pc_reg <= pcin;
					end else begin
						pc_reg <= pc_reg + 1;
					end
					cu_state <= UPDATE_SPI;
				end
			endcase
		end
	end

	always_comb begin
		case (cu_state)
			UPDATE_SPI,
			UPDATE_IR:
				// Turn on PCC and ROMO
				flags_noc = 'b100000000001000000000;
			FLAGS_1,
			FLAGS_1_SPI,
			FLAGS_1_EVENTS: begin
				flags_noc = cu_flag_conv[cu_rom[ir_reg]];
			end
			FLAGS_2,
			FLAGS_2_SPI,
			FLAGS_2_EVENTS: begin
				flags_noc = cu_flag_conv[cu_rom_2[ir_reg]];
			end

			default: 
				flags_noc = 0;
		endcase

		case (cu_state)
			UPDATE_SPI,
			UPDATE_IR,
			FLAGS_1_EVENTS,
			FLAGS_2_EVENTS:
				flags = flags_noc;

			default: 
				flags = 0;
		endcase
	end

	assign pc = pc_reg;
	assign highbits_we = cu_state == FLAGS_1_EVENTS;
	assign cuout = ir_reg;
endmodule
