module spi_master (
  input wire clk,
  input wire rst,
  output reg [7:0] data_out,
  output reg cs,
  output reg sclk,
  output reg mosi,
  input wire miso
);

  reg [7:0] data_in;
  reg [3:0] shift_counter;

  // FSM states
  localparam IDLE = 2'b00;
  localparam TRANSFER = 2'b01;

  reg [1:0] state, next_state;

  always @(posedge clk, posedge rst) begin
    if (rst)
      state <= IDLE;
    else
      state <= next_state;
  end

  always @(posedge clk, posedge rst) begin
    if (rst)
      next_state <= IDLE;
    else
      next_state <= state;
  end

  always @(posedge clk, posedge rst) begin
    if (rst) begin
      sclk <= 0;
      mosi <= 0;
      shift_counter <= 4'b0000;
      cs <= 1;
      data_out <= 8'b00000000;
    end else begin
      case (state)
        IDLE: begin
          cs <= 1;
          sclk <= 0;
          mosi <= 0;
          if (cs == 0) begin
            state <= TRANSFER;
            data_in <= 8'b10101010; // Example: send 0xAA
          end
        end

        TRANSFER: begin
          cs <= 0;
          sclk <= ~sclk;
          if (shift_counter < 8) begin
            mosi <= data_in[7 - shift_counter];
          end else begin
            cs <= 1;
            state <= IDLE;
          end
          shift_counter <= shift_counter + 1;
        end

        default: state <= IDLE;
      endcase
    end
  end

  assign data_out = miso ? 8'b00000001 : 8'b00000000;

endmodule