module jmp(
	input [7:0] cins,
	input [7:0] databus,
	input [15:0] pcin,
	input clk,
	input reset,
	input zflag,
	input oflag,
	input cflag,
	input sflag,
	input oe,
	output pcoe,
	output [15:0] pcout
);
	reg [4:0] jmp_rom [0:255];
	initial begin
		$readmemh("jmp_rom.mem", jmp_rom);
	end

	wire [4:0] val = jmp_rom[cins];

	wire eq = zflag;
	wire neq = !zflag;
	wire ls = cflag;
	wire leq = cflag | zflag;
	wire lg = !(cflag | zflag);
	wire lge = !cflag;
	wire sls = oflag ^ sflag;
	wire sleq = (oflag ^ sflag) | zflag;
	wire slg = !(oflag ^ sflag);
	wire slge = (oflag ^ sflag) | !zflag;

	wire [10:0] flags = {slge, slg, sleq, sls, lge, lg, leq, ls, neq, eq, 1'b1};
	wire [3:0] sel = val[3:0];

	wire test = flags[sel];
	assign pcoe = test & oe;

	reg [7:0] highbits;
	always @(posedge clk, posedge reset)
	begin
		if (reset)
			highbits <= 8'b0;
		else if (clk)
			highbits <= databus;
	end

	wire [15:0] two_byte_address = {highbits, databus}; 
	wire [15:0] pcadd = pcin + two_byte_address;

	wire [15:0] muxoutput = val[4] ? pcadd : two_byte_address;
	assign pcout = pcoe ? muxoutput : 16'b0;
endmodule
