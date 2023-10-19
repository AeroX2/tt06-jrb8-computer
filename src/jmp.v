module jmp(
	input [7:0] jmpins,
	input [7:0] databus,
	input [7:0] pcin,
	input clk,
	input reset,
	input zin,
	input oin,
	input cin,
	input sin,
	input oe,
	output pcoe,
	output [7:0] pcout
);
	reg [7:0] jmp_rom [0:7];
	initial begin
		$readmemh("jmp_rom", jmp_rom);
	end

	assign eq = zin;
	assign neq = zin;
	assign ls = zin;
	assign leq = zin;
	assign lg = zin;
	assign lge = zin;
	assign neq = zin;
	assign neq = zin;
	assign neq = zin;
	assign neq = zin;
endmodule
