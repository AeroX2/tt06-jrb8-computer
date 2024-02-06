module spi(
  input wire sclk,
  input wire rst,
  input wire ready,
  input reg [15:0] address,
  output reg [7:0] data,
  output reg cs,
  output reg mosi,
  input wire miso
);
  localparam READ_COMMAND = 8'h03;

  localparam IDLE = 0,
    SEND_COMMAND = 1,
    SEND_ADDRESS = 2,
    RECEIVE_DATA = 3;

  reg [4:0] shift_counter;
  reg [3:0] state;

  always @(
    posedge sclk,
    posedge rst
  ) begin
    if (rst) begin
      shift_counter <= 0;
      state <= IDLE;
      data <= 0;
      mosi <= 0;
      cs <= 1;
    end else if (sclk) begin
      case (state)
        IDLE: begin
          mosi <= 0;
          cs <= 1;
          if (ready) begin
            cs <= 0;
            shift_counter <= 7;
            state <= SEND_COMMAND;
          end
        end
        SEND_COMMAND: begin
          mosi <= READ_COMMAND[shift_counter];
          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            shift_counter <= 15;
            state <= SEND_ADDRESS;
          end
        end
        SEND_ADDRESS: begin
          mosi <= address[shift_counter];
          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            shift_counter <= 7;
            state <= RECEIVE_DATA;
          end
        end
        RECEIVE_DATA: begin
          data[shift_counter] <= miso;
          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            cs <= 1;
            state <= IDLE;
          end
        end
      endcase
    end
  end
endmodule
