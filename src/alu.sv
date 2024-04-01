module alu(
	input signed [7:0] a,
	input signed [7:0] b,
	input [7:0] cins,
	input oe,
	input carryin,
	output logic carryout,
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
	assign cmpo = oe && val[8];
	
	wire [7:0] aandz = za ? 0 : a;
	wire [7:0] bandz = zb ? 0 : b;
	
	wire [7:0] xora = aandz ^ {8{ia}};
	wire [7:0] xorb = bandz ^ {8{ib}};

	wire [7:0] anded = xora & xorb;
	
	wire carried = carry && carryin;
	wire [8:0] sum = xora + xorb + {9{8'b0, carried}};
	wire [7:0] added = sum[7:0];
	
	wire [8:0] shiftr = {9{xora, carried}} >> xorb;
	wire [8:0] shiftl = {9{xora, carried}} << xorb;

	logic [7:0] muxoutput;
	always_comb begin
		case (val[7:6])
			0: begin
				muxoutput = added;
			end
			1: begin
				muxoutput = anded;
			end
			2: begin
				muxoutput = shiftr;
			end
			3: begin
				muxoutput = shiftl;
			end
		endcase
	end

	assign carryout = val[7:6] == 0 ? sum[8] : 0;
		
	wire [7:0] out1 = muxoutput ^ {8{io}};

	assign aluout = oe ? out1 : 0;
	assign overout = ((~out1[7]) & xora[7] & xorb[7]) | (out1[7] & ~xora[7] & ~xorb[7]);
endmodule
