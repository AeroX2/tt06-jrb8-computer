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

	wire [15:0] in_decoder = 8'b0000_0001 << inflags;
	wire [7:0] out_decoder = 8'b0000_0001 << outflags;

	wire oi = in_decoder[1];
	wire ramil = in_decoder[2];
	wire mari = in_decoder[3];
	wire ai = in_decoder[4];
	wire ci = in_decoder[5];
	wire di = in_decoder[6];
	// wire ramih = in_decoder[7];
	wire halt = in_decoder[15];

	wire io = out_decoder[1];
	wire ao = out_decoder[2];
	wire co = out_decoder[3];
	wire doo = out_decoder[4];
	wire romot = out_decoder[5];
	wire ramo = out_decoder[6];
	wire jmpo = out_decoder[7];

	wire romo = pcc | romot;

	wire [7:0] cins;
	wire pcc;
	wire iri;
	cu cu_module(
		.irin(databus),
		.iri_in(iri),
		.clk(clk),
		.rst(rst),
		.cuout(cins),
		.inflags(inflags),
		.outflags(outflags),
		.pcc(pcc),
		.iri_out(iri)
	);

	wire [7:0] rom;
	wire [7:0] ram;

	wire cs_rom;
	wire cs_ram;
	wire mosi;

	// SPI Ram for ROM memory
	assign uio_oe = 8'b00011010;

	wire miso = uio_in[2];
	wire sclk = uio_in[5] ? uio_in[3] : clk;

	assign uio_out[0] = cs_rom;
	assign uio_out[1] = mosi;
	assign uio_out[2] = 0;
	assign uio_out[3] = 0;
	assign uio_out[4] = cs_ram;
	assign uio_out[5] = 0;
	assign uio_out[6] = 0;
	assign uio_out[7] = 0;

	wire executing;
	spi spi_module(
		.rst(rst),
		.romo(romo),
		.pc(pc),
		.rom(rom),

		.rami(ramil),
		.ramo(ramo),
		.mar({ 8'h0, mar }),
		.ram(ram),

		.databus(databus),

		.executing(executing),

		.sclk(sclk),
		.cs_rom(cs_rom),
		.cs_ram(cs_ram),
		.mosi(mosi),
		.miso(miso)
	);

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
		end else if (clk) begin
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
		else if (clk && pcc && executing) begin
			if (pcinflag) 
				pc <= pcin;
			else 
				pc <= pc + 1;
		end
	end

	// Databus
	wire [7:0] aluout;
	wire [7:0] romg = romo ? rom : 8'h00;
	wire [7:0] ramg = ramo ? ram : 8'h00;
	wire [7:0] iorg = io ? ireg : 8'h00;
	assign databus = romg | aluout | iorg;

	// ALU
	wire [7:0] c_or_d_reg = doo ? creg : dreg;
	wire aluo = ao | co | doo;

	wire overout;
	wire carryout;
	wire cmpo;
	alu alu_module(
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
	cmp cmp_module(
		.cmpin(databus),
		.overflow(overout),
		.carry(carryout),
		.clk(clk),
		.rst(rst),
		.zflag(zflag),
		.oflag(oflag),
		.cflag(cflag),
		.sflag(sflag),
		.we(cmpo)
	);
  
	// JMP
	jmp jmp_module(
		.cins(cins),
		.pcin(pc),
		.databus(databus),
		.clk(clk),
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
