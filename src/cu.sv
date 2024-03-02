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

	logic [15:0] pc_reg;
	wire pcc = fin[7];

	// States
	localparam  UPDATE_SPI   = 0,
				UPDATE_IR    = 1,
				FLAGS_1      = 2,
				UPDATE_SPI_2 = 3,
				FLAGS_2      = 4,
				UPDATE_SPI_3 = 5,
				UPDATE_PC    = 6;

	logic [7:0] fin;
	logic [7:0] ir_reg;
	logic [3:0] cu_state;
	always_ff @(negedge clk, posedge rst) begin
		if (rst) begin
			fin <= 0;
			pc_reg <= 0;
			ir_reg <= 0;
			cu_state <= 0;
			spi_executing <= 0;
		end else if (!halt) begin
			case (cu_state)
				UPDATE_SPI: begin
					fin <= 8'h50;
					spi_executing <= 1;
					if (spi_done) begin
						spi_executing <= 0;
						cu_state <= UPDATE_IR;
					end
				end
				UPDATE_IR: begin
					fin <= 0;
					ir_reg <= irin;
					cu_state <= FLAGS_1;
				end
				FLAGS_1: begin
					fin <= cu_rom[ir_reg];
					if (cu_rom[ir_reg][7] || inflags == 1 || outflags == 5 || cu_rom[ir_reg][6:4] == 6) begin
						spi_executing <= 1;
						cu_state <= UPDATE_SPI_2;
					end else begin
						cu_state <= FLAGS_2;
					end

					if (cu_rom[ir_reg][7]) begin
						pc_reg <= pc_reg + 1;
					end
				end
				UPDATE_SPI_2: begin
					if (spi_done) begin
						spi_executing <= 0;
						cu_state <= FLAGS_2;
					end
				end
				FLAGS_2: begin
					fin <= cu_rom_2[ir_reg];
					if (cu_rom_2[ir_reg][7] || inflags == 1 || outflags == 5 || cu_rom_2[ir_reg][6:4] == 6) begin
						spi_executing <= 1;
						cu_state <= UPDATE_SPI_3;
					end else begin
						cu_state <= UPDATE_PC;
					end

					if (cu_rom_2[ir_reg][7]) begin
						pc_reg <= pc_reg + 1;
					end
				end
				UPDATE_SPI_3: begin
					if (spi_done) begin
						spi_executing <= 0;
						cu_state <= UPDATE_PC;
					end
				end
				UPDATE_PC: begin
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

	assign pc = pc_reg;
	assign en = cu_state == FLAGS_1 || cu_state == FLAGS_2 || cu_state == UPDATE_PC;
	assign inflags = fin[3:0];
	assign outflags = fin[6:4];
	assign cuout = ir_reg;
endmodule