module cu(
	input clk,
	input rst,
	input halt,

	input spi_done,
	output logic spi_executing,

	input [7:0] irin,

	input pcinflag,
	input [15:0] pcin,
	output logic [15:0] pc,
	output logic en,

	output logic [4:0] inflags,
	output logic [3:0] outflags,
	output logic [7:0] cuout
);
	// TODO: Check if roms are actually getting read
	logic [7:0] cu_rom [0:255];
	logic [7:0] cu_rom_2 [0:255];
	initial begin
		$readmemh("../rom/cu_rom.mem", cu_rom);
		$readmemh("../rom/cu_rom_2.mem", cu_rom_2);
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

	logic [7:0] fin;
	logic [7:0] ir_reg;

	logic [15:0] pc_reg;
	logic pcc;

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
					// PCC, RAMI, ROMO, RAMO
					if (cu_rom[ir_reg][7] ||
					    inflags == 2 ||
						outflags == 5 ||
						cu_rom[ir_reg][6:4] == 6
					) begin
						spi_executing <= 1;
						cu_state <= FLAGS_1_SPI;
					end else begin
						cu_state <= FLAGS_1_EVENTS;
					end

					if (cu_rom[ir_reg][7]) begin
						pc_reg <= pc_reg + 1;
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
					// PCC, RAMI, ROMO, RAMO
					if (cu_rom_2[ir_reg][7] ||
					    inflags == 2 ||
						outflags == 5 ||
						cu_rom_2[ir_reg][6:4] == 6
					) begin
						spi_executing <= 1;
						cu_state <= FLAGS_2_SPI;
					end else begin
						cu_state <= FLAGS_2_EVENTS;
					end

					if (cu_rom_2[ir_reg][7]) begin
						pc_reg <= pc_reg + 1;
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
				fin = 8'h50;
			FLAGS_1,
			FLAGS_1_SPI,
			FLAGS_1_EVENTS: begin
				fin = cu_rom[ir_reg];
			end
			FLAGS_2,
			FLAGS_2_SPI,
			FLAGS_2_EVENTS:
				fin = cu_rom_2[ir_reg];

			default: 
				fin = 0;
		endcase
	end

	assign pc = pc_reg;
	assign en = cu_state == UPDATE_IR || cu_state == FLAGS_1_EVENTS || cu_state == FLAGS_2_EVENTS;
	assign inflags = fin[3:0];
	assign outflags = fin[6:4];
	assign cuout = ir_reg;
endmodule