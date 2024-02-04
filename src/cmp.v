module cmp(
	input [7:0] cmpin,
	input we,
	input overflow,
	input carry,
	input clk,
	input rst,
	output reg zflag,
	output reg oflag,
	output reg cflag,
	output reg sflag
);
	always @(posedge clk, posedge rst)
	begin
		if (rst) begin
			zflag <= 0;
			oflag <= 0;
			cflag <= 0;
			sflag <= 0;
		end
		else if (we) begin
			zflag <= cmpin[6:0] == 0;
			oflag <= overflow;
			cflag <= carry;
			sflag <= cmpin[7];
		end
	end
endmodule
