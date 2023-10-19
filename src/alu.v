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
	
	assign za = val[0];
	assign ia = val[1];
	assign zb = val[2];
	assign ib = val[3];
	assign io = val[4];
	assign carry = val[5];
	// assign cselect = val[7:6];
	assign cmpo = oe & val[8];
	
	assign aandz = a & (~za);
	assign bandz = b & (~zb);
	
	assign xora = aandz ^ ia;
	assign xorb = bandz ^ ib;
	
	assign carried = carry & carryin;
	
	wire [8:0] sum = xora + xorb + carried;
	assign added = sum[7:0];
	assign carryout = sum[8];
	
	assign anded = xora & xorb;
	
	assign shiftr = xora >> xorb;
	assign shiftl = xora << xorb;
	
	assign ml = val[6];
	assign mh = val[7];
	
	assign muxoutput = mh ? (ml ? shiftl : shiftr) : (ml ? anded : added);
		
	wire [7:0] out1 = added ^ io;
	assign aluout = oe & out1;
	
	assign overout = ((~out1[7]) & a[7] & b[7]) | (out1[7] & ~a[7] & ~b[7]);
endmodule
