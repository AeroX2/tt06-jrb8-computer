module cu(
	input [7:0] irin,
	input iri_in,
	input clk,
	input reset,
	output [4:0] inflags,
	output [3:0] outflags,
	output pcc,
	output iri_out,
	output cuout
);
	reg [7:0] cu_rom [0:7];
	reg [7:0] cu_rom_2 [0:7];
	initial begin
		$readmemh("cu_rom.mem", cu_rom);
		$readmemh("cu_rom_2.mem", cu_rom_2);
	end

	reg [7:0] ir_reg;
	always @(posedge clk, posedge reset)
	begin
		if (reset)
			ir_reg <= 1'b0;
		else if (clk && iri_in)
			ir_reg <= irin;
	end
	assign cuout = ir_reg;

	reg [2:0] cuctr;
	always @(posedge clk, posedge reset)
	begin
		if (reset)
			cuctr <= 0;
		else if (clk)
			cuctr <= cuctr + 1;
	end

	assign iri_out = cuctr[0];

	wire [7:0] val = cu_rom[ir_reg];
	wire [7:0] val2 = cu_rom_2[ir_reg];

	wire [7:0] fin = (val & cuctr[1]) | (val2 & cuctr[2]);
	assign inflags = fin[3:0];
	assign outflags = fin[6:4];
	assign pcc = iri_out | fin[7];
endmodule
