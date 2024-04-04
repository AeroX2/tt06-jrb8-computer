module alu(
	input clk,
	input rst,

	// Control
	input start,
	output logic done,

	// Inputs
	input [7:0] a,
	input [7:0] b,
	input [7:0] cins,
	input oe,
	input carryin,

	// Outputs
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
	
	wire za = val[0];
	wire ia = val[1];
	wire zb = val[2];
	wire ib = val[3];
	wire io = val[4];
	wire high = val[5];
	wire [1:0] cselect = val[7:6];


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
	wire carried = cmp_mode && carryin;
	
	logic [7:0] aandz;
	logic [7:0] bandz;
	
	logic [7:0] xora;
	logic [7:0] xorb;

	logic [8:0] full_sum;
	logic [7:0] muxoutput;

	logic [15:0] mult;

	// wire [8:0] full_sum = xora + xorb + {9{8'b0, carried}};
	// wire [7:0] sum = full_sum[7:0];

	// // Constant selects not support in always_comb
	// wire [15:0] mult = signed_mode ? $signed(xora) * $signed(xorb) : xora * xorb;
	// wire [7:0] mult_split = high ? mult[15:8] : mult[7:0];

	// logic [7:0] div;
	// always_comb begin
	// 	if (signed_mode) begin
	// 		div = $signed(xora) / $signed((xorb == 0 ? 1 : xorb));
	// 	end else begin
	// 		div = xora / (xorb == 0 ? 1 : xorb);
	// 	end
	// end

	// // Constant selects not support in always_comb
	// logic [7:0] muxoutput;
	// always_comb begin
	// 	case (cselect)
	// 		0: muxoutput = sum;
	// 		1: muxoutput = anded;
	// 		2: muxoutput = mult_split;
	// 		3: muxoutput = div;
	// 		default: muxoutput = 0;
	// 	endcase
	// end

	logic [3:0] state;
	always_ff @(posedge clk, posedge rst) begin
		if (rst) begin
			state <= 0;
			done <= 0;
		end else if (clk) begin
			case (state)
				0: begin
					done <= 1;
					if (start) begin
						done <= 0;
						state <= 1;
					end
				end
				1: begin
					aandz <= za ? 0 : a;
					bandz <= zb ? 0 : b;
					state <= 1;
				end
				2: begin
					xora <= aandz ^ {8{ia}};
					xorb <= bandz ^ {8{ib}};

					state <= cselect + 3;
				end
				3: begin
					full_sum <= xora + xorb + {9{8'b0, carried}};
					muxoutput <= full_sum[7:0];
					state <= 7;
				end
				4: begin
					muxoutput <= xora & xorb;
					state <= 7;
				end
				5: begin
					mult = signed_mode ? $signed(xora) * $signed(xorb) : xora * xorb;
					muxoutput <= 0;// high ? mult[15:8] : mult[7:0];
					state <= 7;
				end
				6: begin
					if (signed_mode) begin
						muxoutput <= 0; //$signed(xora) / $signed((xorb == 0 ? 1 : xorb));
					end else begin
						muxoutput <= 0;// xora / (xorb == 0 ? 1 : xorb);
					end
					state <= 7;
				end
				7: begin
					state <= 0;
				end
			endcase
		end
	end
		
	wire [7:0] out1 = muxoutput ^ {8{io}};

	assign aluout = oe ? out1 : 0;
	assign cmpo = oe || cmp_mode || cins == CLR_CMP_INS;
	assign carryout = cselect == 0 ? full_sum[8] : 0;
	assign overout = ((~out1[7]) & xora[7] & xorb[7]) | (out1[7] & ~xora[7] & ~xorb[7]);
endmodule
