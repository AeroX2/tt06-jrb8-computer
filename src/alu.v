module alu(
	input [7:0] a,
	input [7:0] b,
	input [7:0] cins,
	input oe,
	input carryin,
	output carryout,
	output aluout,
	output overout,
	output cmpo
);
	reg [7:0] alu_rom [0:7];
	initial begin
		$readmemh("alu_rom.mem", alu_rom);
	end
	
	wire [7:0] val = alu_rom[cins];
	
	wire za = val[0];
	wire ia = val[1];
	wire zb = val[2];
	wire ib = val[3];
	wire io = val[4];
	wire carry = val[5];
	// wire cselect = val[7:6];
	assign cmpo = oe & val[8];
	
	wire aandz = a & (~za);
	wire bandz = b & (~zb);
	
	wire xora = aandz ^ ia;
	wire xorb = bandz ^ ib;
	
	wire carried = carry & carryin;
	
	wire [8:0] sum = xora + xorb + carried;
	wire [7:0] added = sum[7:0];
	assign carryout = sum[8];
	
	wire anded = xora & xorb;
	
	wire shiftr = xora >> xorb;
	wire shiftl = xora << xorb;
	
	wire ml = val[6];
	wire mh = val[7];
	
	wire muxoutput = mh ? (ml ? shiftl : shiftr) : (ml ? anded : added);
		
	wire [7:0] out1 = added ^ io;
	assign aluout = oe & out1;
	
	assign overout = ((~out1[7]) & a[7] & b[7]) | (out1[7] & ~a[7] & ~b[7]);
endmodule
