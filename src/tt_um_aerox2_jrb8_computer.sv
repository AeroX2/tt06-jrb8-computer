`default_nettype none

module tt_um_aerox2_jrb8_computer #(
    parameter MAX_COUNT = 24'd10_000_000
) (
    input  wire [7:0] ui_in,    // Dedicated inputs - connected to the input switches
    output wire [7:0] uo_out,   // Dedicated outputs - connected to the 7 segment display
    input wire [7:0] uio_in,  // IOs: Bidirectional Input path
    output wire [7:0] uio_out,  // IOs: Bidirectional Output path
    output wire [7:0] uio_oe,   // IOs: Bidirectional Enable path (active high: 0=input, 1=output)
    input wire ena,  // will go high when the design is enabled
    input wire clk,  // clock
    input wire rst_n  // reset_n - low to reset
);
  wire rst = !rst_n;

  reg [7:0] mar;
  reg [7:0] mpage;
  reg [7:0] areg;
  reg [7:0] breg;
  reg [7:0] creg;
  reg [7:0] dreg;
  reg [7:0] oreg;
  reg [7:0] ireg;

  // Input/output pins
  assign uio_oe[0] = 1;
  assign uio_oe[1] = 1;
  assign uio_oe[2] = 0;
  assign uio_oe[3] = 1;
  assign uio_oe[4] = 1;
  assign uio_oe[5] = 0;
  assign uio_oe[6] = 0;
  assign uio_oe[7] = 0;

  assign uio_out[0] = cs_rom;
  assign uio_out[1] = mosi;
  assign uio_out[2] = 0;
  assign uio_out[3] = sclk;
  assign uio_out[4] = cs_ram;
  assign uio_out[5] = 0;
  assign uio_out[6] = 0;
  assign uio_out[7] = 0;

  assign uo_out = oreg;

  // Internal registers
  // A, B, C, D, O, I
  always @(posedge clk, posedge rst) begin
    if (rst) begin
      mar   <= 0;
      mpage <= 0;
      areg  <= 0;
      breg  <= 0;
      creg  <= 0;
      dreg  <= 0;
      oreg  <= 0;
      ireg  <= 0;
    end else if (clk) begin
      if (mari) mar <= databus;
      else if (mpagei) mpage <= databus;
      else if (ai) areg <= databus;
      else if (bi) breg <= databus;
      else if (ci) creg <= databus;
      else if (di) dreg <= databus;
      else if (oi) oreg <= databus;
      ireg <= ui_in;
    end
  end

  logic [21:0] flags_noc;
  wire romo_noc = flags_noc[9];
  wire ramo_noc = flags_noc[10];
  wire rami_noc = flags_noc[13];

  wire cs;
  wire cs_rom = romo_noc ? cs : 1;
  wire cs_ram = (rami_noc || ramo_noc) ? cs : 1;

  wire mosi;
  wire miso = uio_in[2];
  wire sclk;

  wire [7:0] spi_data;
  wire spi_executing;
  wire spi_done;
  // SPI Ram for ROM memory
  spi spi_module (
      .clk(clk),
      .rst(rst),

      .databus(databus),

      .start(spi_executing),
      .done(spi_done),
      .write(rami_noc),
      .address(romo_noc ? pc : {mpage, mar}),
      .data(spi_data),

      .sclk(sclk),
      .cs  (cs),
      .mosi(mosi),
      .miso(miso)
  );

  // CU decoding the instruction
  wire io = flags[0];
  wire ao = flags[1] || (flags_noc[1] && rami_noc);
  wire bo = flags[2] || (flags_noc[2] && rami_noc);
  wire co = flags[3] || (flags_noc[3] && rami_noc);
  wire doo = flags[4] || (flags_noc[4] && rami_noc);
  wire ao2 = flags[5];
  wire bo2 = flags[6];
  wire co2 = flags[7];
  wire doo2 = flags[8];
  wire romo = flags[9];
  wire ramo = flags[10];
  wire jmpo = flags[11];

  wire oi = flags[12];
  // wire rami = flags[13];
  wire mari = flags[14];
  wire mpagei = flags[15];
  wire ai = flags[16];
  wire bi = flags[17];
  wire ci = flags[18];
  wire di = flags[19];
  // wire pcc = flags[20];
  wire halt = flags[21];

  // Databus
  wire [7:0] aluout;
  wire aluo = ao | bo | co | doo;
  logic [7:0] databus;

  always_comb begin
    databus = 0;
    if (aluo) databus = aluout;
    else if (romo || ramo) databus = spi_data;
    else if (io) databus = ireg;
  end

  wire highbits_we;
  wire pcinflag;
  wire [15:0] pc;
  wire [15:0] pcin;
  logic [21:0] flags;

  // CU
  wire [7:0] cins;
  cu cu_module (
      .clk(clk),
      .rst(rst),
      .halt(halt),
      .highbits_we(highbits_we),

      .spi_executing(spi_executing),
      .spi_done(spi_done),

      .alu_executing(alu_executing),
      .alu_done(alu_done),

      // TODO: This was .irin(databus)
      // Having it this way prevents an EXECUTE command in the future.
      .irin(spi_data),

      .pcinflag(pcinflag),
      .pcin(pcin),
      .pc(pc),

      .flags(flags),
      .flags_noc(flags_noc),
      .cuout(cins)
  );

  logic [7:0] a_alu_in;
  logic [7:0] b_alu_in;
  always_comb begin
    if (ao) a_alu_in = areg;
    else if (bo) a_alu_in = breg;
    else if (co) a_alu_in = creg;
    else if (doo) a_alu_in = dreg;
    else a_alu_in = 0;

    if (ao2) b_alu_in = areg;
    else if (bo2) b_alu_in = breg;
    else if (co2) b_alu_in = creg;
    else if (doo2) b_alu_in = dreg;
    else b_alu_in = 0;
  end

  // ALU
  wire overout;
  wire carryout;
  wire cmpo;
  wire alu_executing;
  wire alu_done;
  alu alu_module (
      .clk(clk),
      .rst(rst),
      .start(alu_executing),
      .done(alu_done),
      .a(a_alu_in),
      .b(b_alu_in),
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
  cmp cmp_module (
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
  jmp jmp_module (
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
      .oe(jmpo),
      .highbits_we(highbits_we)
  );
endmodule
