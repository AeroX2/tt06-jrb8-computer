module alu(
	input signed [7:0] a,
	input signed [7:0] b,
	input [7:0] cins,
	input oe,
	input carryin,
	output carryout,
	output signed [7:0] aluout,
	output overout,
	output cmpo
);
	// TODO: Check if roms are actually getting read
	reg [8:0] alu_rom [0:255];
	initial begin
		$readmemh("../rom/alu_rom.mem", alu_rom);
	end
	
	wire [8:0] val = alu_rom[cins];
	
	wire za = val[0];
	wire ia = val[1];
	wire zb = val[2];
	wire ib = val[3];
	wire io = val[4];
	wire carry = val[5];
	// wire cselect = val[7:6];
	assign cmpo = oe && val[8];
	
	wire [7:0] aandz = za ? 0 : a;
	wire [7:0] bandz = zb ? 0 : b;
	
	wire signed [7:0] xora = aandz ^ {8{ia}};
	wire signed [7:0] xorb = bandz ^ {8{ib}};
	
	wire carried = carry && carryin;
	
	wire signed [8:0] sum = xora + xorb + {9{8'b0, carried}};
	wire signed [7:0] added = sum[7:0];
	
	wire [7:0] anded = xora & xorb;
	
	wire [7:0] shiftr = xora >> xorb;
	wire [7:0] shiftl = xora << xorb;
	
	wire ml = val[6];
	wire mh = val[7];
	
	wire [7:0] muxoutput = mh ? (ml ? shiftl : shiftr) : (ml ? anded : added);
		
	wire [7:0] out1 = muxoutput ^ {8{io}};

	assign aluout = oe ? out1 : 0;
	assign carryout = sum[8];
	assign overout = ((~out1[7]) & a[7] & b[7]) | (out1[7] & ~a[7] & ~b[7]);
endmodule
