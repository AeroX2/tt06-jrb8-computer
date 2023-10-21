`default_nettype none

module tt_um_jrb8_computer #( parameter MAX_COUNT = 24'd10_000_000 ) (
    input  wire [7:0] ui_in,    // Dedicated inputs - connected to the input switches
    output wire [7:0] uo_out,   // Dedicated outputs - connected to the 7 segment display
    input  wire [7:0] uio_in,   // IOs: Bidirectional Input path
    output wire [7:0] uio_out,  // IOs: Bidirectional Output path
    output wire [7:0] uio_oe,   // IOs: Bidirectional Enable path (active high: 0=input, 1=output)
    input  wire       ena,      // will go high when the design is enabled
    input  wire       clk,      // clock
    input  wire       rst_n     // reset_n - low to reset
);
	wire rst = !rst_n;
    // instantiate segment display
    // seg7 seg7(.counter(digit), .segments(led_out));
	//
	wire [7:0] databus;	


	reg [7:0] areg;
	reg [7:0] creg;
	reg [7:0] dreg;
	reg [7:0] oreg;

	wire [4:0] inflags;
	wire [3:0] outflags;

	wire [7:0] in_decoder = 8'b0000_0001 << inflags;
	wire [7:0] out_decoder = 8'b0000_0001 << outflags;

	wire oi = in_decoder[0];
	wire rami = in_decoder[1];
	wire mari = in_decoder[2];
	wire ai = in_decoder[3];
	wire ci = in_decoder[4];
	wire di = in_decoder[5];

	wire io = out_decoder[0];
	wire ao = out_decoder[1];
	wire co = out_decoder[2];
	wire doo = out_decoder[3];
	wire romot = out_decoder[4];
	wire ramo = out_decoder[5];
	wire jmpo = out_decoder[6];

	always @(posedge clk, posedge rst_n)
	begin
		if (rst_n) begin
			areg <= 0;
			creg <= 0;
			dreg <= 0;
			oreg <= 0;
		end else if (clk) begin
			if (ai)
				areg <= databus;
			if (ci)
				creg <= databus;
			if (di)
				creg <= databus;
			if (oi)
				creg <= databus;
		end
	end

	reg [7:0] pc_low;
	reg [7:0] pc_high;

	always @(posedge clk, posedge rst_n)
	begin
		if (rst_n) begin
			pc_low <= 0;
			pc_high <= 0;
		end else if (clk) begin
			pc_low = pc_low + 1;
		end
	end

	assign uo_out = oreg;

	wire [7:0] cins;
	wire pcc;
	wire iri;
	cu cu(
		.irin(databus),
		.iri_in(iri),
		.clk(clk),
		.reset(rst),
		.cuout(cins),
		.inflags(inflags),
		.outflags(outflags),
		.pcc(pcc),
		.iri_out(iri)
	);

	wire c_or_d_reg = doo ? creg : dreg;

	wire aluo = ao | co | doo;

	wire overout;
	wire carryout;
	wire cmpo;
	alu alu(
		.a(areg),
		.b(c_or_d_reg),
		.carryin(1),
		.oe(aluo),
		.cins(cins),
		.aluout(databus),
		.overout(overout),
		.carryout(carryout),
		.cmpo(cmpo)
	);

	wire zflag;
	wire oflag;
	wire cflag;
	wire sflag;
	cmp cmp(
		.cmpin(databus),
		.overflow(overout),
		.carry(carryout),
		.clk(clk),
		.reset(rst),
		.zflag(zflag),
		.oflag(oflag),
		.cflag(cflag),
		.sflag(sflag)
	);

endmodule
