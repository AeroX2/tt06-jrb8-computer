module alu(
	input clk,
	input rst,
	input [7:0] a,
	input [7:0] b,
	input [7:0] cins,
	input oe,
	input carryin,
	output logic carryout,
	output [7:0] aluout,
	output overout,
	output cmpo
);
	localparam CLR_CMP_INS  = 'h40;
	localparam CMP_OFF_INS  = 'h41;
	localparam CMP_ON_INS   = 'h42;
	localparam SIGN_OFF_INS = 'h43;
	localparam SIGN_ON_INS  = 'h44;

	reg [9:0] alu_rom [0:255];
	initial begin
		$readmemh("../rom/alu_rom.mem", alu_rom);
	end
	wire [8:0] val = alu_rom[cins];

	logic cmp_mode;
	logic signed_mode;
	always_ff @(posedge clk, posedge rst) begin
		if (rst) begin
			cmp_mode <= 0;
			signed_mode <= 0;
		end else if (clk) begin
			if (cins == CMP_OFF_INS)
				cmp_mode <= 0;
			else if (cins == CMP_ON_INS)
				cmp_mode <= 1;
			else if (cins == SIGN_OFF_INS)
				signed_mode <= 0;
			else if (cins == SIGN_ON_INS)
				signed_mode <= 1;
		end
	end
	
	wire za = val[0];
	wire ia = val[1];
	wire zb = val[2];
	wire ib = val[3];
	wire io = val[4];
	wire high = val[5];
	assign cmpo = oe || cmp_mode || cins == CLR_CMP_INS;
	
	wire [7:0] aandz = za ? 0 : a;
	wire [7:0] bandz = zb ? 0 : b;
	
	wire [7:0] xora = aandz ^ {8{ia}};
	wire [7:0] xorb = bandz ^ {8{ib}};

	wire [7:0] anded = xora & xorb;

	wire carried = cmp_mode && carryin;
	wire [8:0] full_sum = xora + xorb + {9{8'b0, carried}};
	wire [7:0] sum = full_sum[7:0];

	// Constant selects not support in always_comb
	wire [15:0] mult = signed_mode ? $signed(xora) * $signed(xorb) : xora * xorb;
	wire [7:0] mult_split = high ? mult[15:8] : mult[7:0];

	logic [7:0] div;
	always_comb begin
		if (signed_mode) begin
			div = $signed(xora) / $signed((xorb == 0 ? 1 : xorb));
		end else begin
			div = xora / (xorb == 0 ? 1 : xorb);
		end
	end

	// Constant selects not support in always_comb
	wire [1:0] cselect = val[7:6];
	logic [7:0] muxoutput;
	always_comb begin
		case (cselect)
			0: muxoutput = sum;
			1: muxoutput = anded;
			2: muxoutput = mult_split;
			3: muxoutput = div;
			default: muxoutput = 0;
		endcase
	end
		
	wire [7:0] out1 = muxoutput ^ {8{io}};

	assign aluout = oe ? out1 : 0;
	assign carryout = cselect == 0 ? full_sum[8] : 0;
	assign overout = ((~out1[7]) & xora[7] & xorb[7]) | (out1[7] & ~xora[7] & ~xorb[7]);
endmodule
