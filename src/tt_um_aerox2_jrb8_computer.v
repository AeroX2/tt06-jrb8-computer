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

	wire sclk = ui_in[0];
	wire ready = ui_in[1];
	wire serial_in = ui_in[2];

	wire serial_out = uo_out[0];
	wire pc_in_flag = uo_out[1];
	wire rom_out_flag = uo_out[2];
	wire ram_in_flag = uo_out[3];
	wire ram_out_flag = uo_out[4];

	reg [7:0] rom;
	reg [7:0] ram;
	reg [4:0] serial_counter;
	reg serial_out_reg;

	assign pc_in_flag = !executing && serial_counter >= 8;
	assign serial_out = serial_out_reg;
	assign rom_out_flag = romo;
	assign ram_in_flag = rami;
	assign ram_out_flag = ramo;

	wire executing = serial_counter == 0;

	always @(
		posedge sclk,
		posedge romo,
		posedge rst
	)
	begin
		if (rst) begin
			serial_counter <= 0;
			serial_out_reg <= 0;
			rom <= 8'b00;
		end else if (sclk && serial_counter > 0 && ready) begin
			if (romo) begin
				serial_counter = serial_counter - 1;
				if (serial_counter < 8) begin
					rom[serial_counter] <= serial_in;
				end else begin
					serial_out_reg <= pc[serial_counter-8];
				end
			end
		end else if (romo && serial_counter == 0) begin
			serial_counter <= 16+8;
		end
	end

	always @(
		posedge sclk,
		posedge rami,
		posedge ramo,
		posedge rst
	)
	begin
		if (rst) begin
			serial_counter <= 0;
			serial_out_reg <= 0;
			ram <= 8'b00;
		end else if (sclk && serial_counter > 0 && ready) begin
			if (rami) begin
				serial_counter = serial_counter - 1;
				ram[serial_counter] <= serial_in;
			end else if (ramo) begin
				serial_counter = serial_counter - 1;
				serial_out_reg <= ram[serial_counter];
			end
		end else if ((rami | ramo) && serial_counter == 0) begin
			serial_counter <= 8;
		end
	end

	always @(posedge clk, posedge rst)
	begin
		if (rst) begin
			areg <= 0;
			creg <= 0;
			dreg <= 0;
			oreg <= 0;
		end else if (clk & executing) begin
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

    wire pcinflag;
    wire [15:0] pcin;
	reg [15:0] pc;

	always @(posedge clk, posedge rst)
	begin
		if (rst) begin
			pc <= 0;
		end else if (clk & executing) begin
			if (pcinflag) begin
				pc = pcin;
			end else begin
				pc = pc + 1;
			end
		end
	end

	assign uo_out[5] = 0;
	assign uo_out[6] = 0;
	assign uo_out[7] = 0;
	assign uio_out = oreg;
	assign uio_oe = 8'h00;

	wire [7:0] aluout;
	wire [7:0] romg = romo ? rom : 8'b00;
	wire [7:0] ramg = ramo ? ram : 8'b00;
	assign databus = romg | ramg | aluout;

	wire [7:0] cins;
	wire pcc;
	wire iri;
	cu cu(
		.irin(databus),
		.iri_in(iri),
		.clk(clk & executing),
		.reset(rst),
		.cuout(cins),
		.inflags(inflags),
		.outflags(outflags),
		.pcc(pcc),
		.iri_out(iri)
	);

	wire romo = pcc | romot;
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

	wire zflag;
	wire oflag;
	wire cflag;
	wire sflag;
	cmp cmp(
		.cmpin(databus),
		.overflow(overout),
		.carry(carryout),
		.clk(clk & executing),
		.reset(rst),
		.zflag(zflag),
		.oflag(oflag),
		.cflag(cflag),
		.sflag(sflag)
	);
  
	// TODO This will somehow have to trigger the serial out for pc otherwise we will be restricted to 8bit addressing
	jmp jmp(
		.cins(cins),
		.pcin(pc),
		.databus(databus),
		.clk(clk & executing),
		.reset(rst),
		.zflag(zflag),
		.oflag(oflag),
		.cflag(cflag),
		.sflag(sflag),
		.pcoe(pcinflag),
		.pcout(pcin)
	);
endmodule
