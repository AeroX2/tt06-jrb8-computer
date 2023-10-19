module cmp(
	input [7:0] cmpin,
	input oe,
	input overflow,
	input carry,
	input clk,
	input reset
);
	reg zflag;
	reg oflag;
	reg cflag;
	reg sflag;

	always @ (posedge clk)
	begin
		zflag <= (oe & cmpin[6:0]);
		oflag <= (oe & overflow);
		cflag <= (oe & carry);
		sflag <= (oe & cmpin[7]);
	end

	always @ (posedge reset)
	begin
		zflag <= 0;
		oflag <= 0;
		cflag <= 0;
		sflag <= 0;
	end
endmodule
