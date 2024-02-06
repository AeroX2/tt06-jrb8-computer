`default_nettype none

module tt_um_aerox2_jrb8_computer #( parameter MAX_COUNT = 24'd10_000_000 ) (
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
	wire [7:0] databus;	

	reg [7:0] mar;
	reg [7:0] areg;
	reg [7:0] creg;
	reg [7:0] dreg;
	reg [7:0] oreg;
	reg [7:0] ireg;

	// CU decoding the instruction
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
	wire romo = pcc | romot;

	wire [7:0] cins;
	wire pcc;
	wire iri;
	cu cu(
		.irin(databus),
		.iri_in(iri),
		.clk(clk && executing),
		.rst(rst),
		.cuout(cins),
		.inflags(inflags),
		.outflags(outflags),
		.pcc(pcc),
		.iri_out(iri)
	);

	reg [7:0] rom;
	reg [7:0] ram [0:255];

	//TODO
	wire executing = romo;

	// Appease the synthesis linter
	// assign uio_out[0] = 0;
	// assign uio_out[1] = 0;
	assign uio_out[2] = 0;
	assign uio_out[3] = 0;
	assign uio_out[4] = 0;
	assign uio_out[5] = 0;
	assign uio_out[6] = 0;
	assign uio_out[7] = 0;

	// SPI Ram for ROM memory
	// reg cs;
	// reg mosi;
	assign uio_oe = 8'b00001010;

	// assign uio_out[0] = cs;
	// assign uio_out[1] = mosi;
	wire cs = uio_out[0];
	wire mosi = uio_out[1];
	wire miso = uio_in[2];
	wire sclk = uio_in[4] ? uio_in[3] : clk;

	spi spi(
		.sclk(sclk),
		.rst(rst),
		.address(pc),
		.data(rom),
		.cs(cs),
		.mosi(mosi),
		.miso(miso),
		.ready(romo)
	);

	// 1 byte by 256 byte RAM
	int i;
	always @(posedge clk, posedge rst)
	begin
		if (rst) begin
			for (i = 0; i < 255; i++) begin
				ram[i] = 0;
			end
		end else if (clk && executing && rami) begin
			ram[mar] <= databus;	
		end
	end

	// Internal registers
	// A, B, C, D, O, I
	always @(posedge clk, posedge rst)
	begin
		if (rst) begin
			mar <= 0;
			areg <= 0;
			creg <= 0;
			dreg <= 0;
			oreg <= 0;
			ireg <= 0;
		end else if (clk && executing) begin
			if (mari)
				mar <= databus;
			if (ai)
				areg <= databus;
			if (ci)
				creg <= databus;
			if (di)
				creg <= databus;
			if (oi)
				oreg <= databus;
			ireg <= ui_in;
		end
	end
	assign uo_out = oreg;

    wire pcinflag;
    wire [15:0] pcin;
	reg [15:0] pc;

	always @(posedge clk, posedge rst)
	begin
		if (rst)
			pc <= 0;
		else if (clk && executing) begin
			if (pcinflag) 
				pc <= pcin;
			else 
				pc <= pc + 1;
		end
	end

	// Databus
	wire [7:0] aluout;
	wire [7:0] romg = romo ? rom : 8'h00;
	wire [7:0] ramg = ramo ? ram[mar] : 8'h00;
	wire [7:0] iorg = io ? ireg : 8'h00;
	assign databus = romg | ramg | aluout | iorg;

	// ALU
	wire [7:0] c_or_d_reg = doo ? creg : dreg;
	wire aluo = ao | co | doo;

	wire overout;
	wire carryout;
	wire cmpo;
	alu alu(
		.a(areg),
		.b(c_or_d_reg),
		.carryin(cflag),
		.oe(aluo),
		.cins(cins),
		.aluout(aluout),
		.overout(overout),
		.carryout(carryout),
		.cmpo(cmpo)
	);

	// CMP
	wire zflag;
	wire oflag;
	wire cflag;
	wire sflag;
	cmp cmp(
		.cmpin(databus),
		.overflow(overout),
		.carry(carryout),
		.clk(clk && executing),
		.rst(rst),
		.zflag(zflag),
		.oflag(oflag),
		.cflag(cflag),
		.sflag(sflag),
		.we(cmpo)
	);
  
	// JMP
	jmp jmp(
		.cins(cins),
		.pcin(pc),
		.databus(databus),
		.clk(clk && executing),
		.rst(rst),
		.zflag(zflag),
		.oflag(oflag),
		.cflag(cflag),
		.sflag(sflag),
		.pcoe(pcinflag),
		.pcout(pcin),
		.oe(jmpo)
	);
endmodule
