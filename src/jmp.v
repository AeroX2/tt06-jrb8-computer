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
		$readmemh("jmp_rom.mem", jmp_rom);
	end

	wire [4:0] val = jmp_rom[jmpins];

	assign eq = zin;
	assign neq = !zin;
	assign ls = cin;
	assign leq = cin | zin;
	assign lg = !(cin | zin);
	assign lge = !cin;
	assign sls = oin ^ sin;
	assign sleq = (oin ^ sin) | zin;
	assign slg = !(oin ^ sin);
	assign slge = (oin ^ sin) | !zin;

	wire [10:0] flags = {1'b1, eq, neq, ls, leq, lg, lge, sls, sleq, slg, slge};
	wire [3:0] sel = val[3:0];

	assign pcoe = sel[flags] & oe;

	reg [7:0] highbits;
	always @(posedge clk, posedge reset)
	begin
		if (reset)
			highbits <= 1'b0;
		else if (clk)
			highbits <= databus;
	end

	assign two_byte_address = {databus, highbits}; 
	assign pcadd = pcin + two_byte_address;

	assign muxoutput = val[4] ? two_byte_address : pcadd;
	assign pcout = pcoe & muxoutput;
endmodule
