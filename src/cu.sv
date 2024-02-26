module cu(
	input [7:0] irin,
	input clk,
	input rst,
	output logic [4:0] inflags,
	output logic [3:0] outflags,
	output logic pcc,
	output logic [7:0] cuout
);
	// TODO: Check if roms are actually getting read
	logic [7:0] cu_rom [0:255];
	logic [7:0] cu_rom_2 [0:255];
	initial begin
		$readmemh("../rom/cu_rom.mem", cu_rom);
		$readmemh("../rom/cu_rom_2.mem", cu_rom_2);
	end

	logic ir_en;
	logic [7:0] fin;

	logic [2:0] cuctr;
	logic [7:0] ir_reg;

	always_ff @(posedge clk, posedge rst)
	begin
		if (rst) begin
			cuctr <= 0;
			ir_reg <= 8'h00;
		end else if (clk) begin
			cuctr <= cuctr + 1 <= 3 ? cuctr + 1 : 0;
			if (ir_en)
				ir_reg <= irin;
		end
	end

	always_comb begin
		ir_en = cuctr == 0;
		cuout = ir_reg;

		case (cuctr)
			1:
				fin = cu_rom[ir_reg];
			2:
				fin = cu_rom_2[ir_reg];
			default:
				fin = 8'h00;
		endcase
	end

	assign inflags = fin[3:0];
	assign outflags = fin[6:4];
	assign pcc = fin[7] | ir_en;
endmodule