module jmp (
    input [7:0] cins,
    input [7:0] databus,
    input [15:0] pcin,
    input clk,
    input rst,
    input zflag,
    input oflag,
    input cflag,
    input sflag,
    input oe,
    input highbits_we,
    output pcoe,
    output [15:0] pcout
);
  reg [4:0] jmp_rom[0:255];

  initial begin
    $readmemh("../rom/jmp_rom.mem", jmp_rom);
  end

  wire [4:0] val = jmp_rom[cins];

  wire eq = zflag;
  wire neq = !zflag;
  wire less = cflag;
  wire less_or_equal = cflag | zflag;
  wire larger = !cflag & !zflag;
  wire larger_or_equal = !cflag;
  wire signed_less = oflag ^ sflag;
  wire signed_less_or_equal = (oflag ^ sflag) | zflag;
  wire signed_larger = (oflag == sflag) & !zflag;
  wire signed_larger_or_equal = (oflag == sflag);  // | zflag;
  wire z = zflag;
  wire o = oflag;
  wire c = cflag;
  wire s = sflag;

  wire [14:0] flags = {
    s,
    c,
    o,
    z,
    signed_larger_or_equal,
    signed_larger,
    signed_less_or_equal,
    signed_less,
    larger_or_equal,
    larger,
    less_or_equal,
    less,
    neq,
    eq,
    1'b1
  };
  wire [3:0] sel = val[3:0];

  assign pcoe = oe ? flags[sel] : 0;

  reg [7:0] highbits;
  always_ff @(posedge clk, posedge rst) begin
    if (rst) highbits <= 0;
    else if (highbits_we) highbits <= databus;
  end

  wire [15:0] two_byte_address = {highbits, databus};
  wire [15:0] pcadd = pcin + two_byte_address;

  wire [15:0] muxoutput = val[4] ? pcadd : two_byte_address;
  assign pcout = pcoe ? muxoutput : 0;
endmodule
