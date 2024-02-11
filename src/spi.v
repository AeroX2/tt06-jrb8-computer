module spi(
  input rst,
  input romo,
  input [15:0] pc,
  output [7:0] rom,

  input rami,
  input ramo,
  input [15:0] mar,
  output [7:0] ram,

  input [7:0] databus,

  output executing,

  input sclk,
  output cs_rom,
  output cs_ram,
  output mosi,
  input miso
);
  localparam READ_COMMAND = 8'h03;
  localparam WRITE_COMMAND = 8'h02;

  localparam IDLE = 0,
    SEND_COMMAND = 1,
    SEND_ADDRESS = 2,
    SEND_DATA    = 3,
    RECEIVE_DATA = 4;

  reg [4:0] shift_counter;
  reg [3:0] state;

  reg [7:0] data_reg;
  reg executing_reg;

  reg rising_edge;
  reg cs_reg;
  reg mosi_reg;

  always @(
    // Negedge of sclk because we want to clock the data in before the next positive edge
    // SPI mode should be 0.
    negedge sclk, 
    posedge rst
  ) begin
    if (rst) begin
      shift_counter <= 0;
      state <= IDLE;

      data_reg <= 0;
      executing_reg <= 1;

      rising_edge <= 0;

      cs_reg <= 1;
      mosi_reg <= 0;
    end else if (!sclk) begin
      case (state)
        IDLE: begin
          executing_reg <= 1;
          mosi_reg <= 0;
          cs_reg <= 1;
          if ((romo || ramo || rami) & ~rising_edge) begin
            executing_reg <= 0;
            cs_reg <= 0;
            shift_counter <= 7;
            state <= SEND_COMMAND;
          end
          rising_edge <= romo || ramo || rami;
        end
        SEND_COMMAND: begin
          if (rami)
            mosi_reg <= WRITE_COMMAND[shift_counter];
          else
            mosi_reg <= READ_COMMAND[shift_counter];

          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            shift_counter <= 15;
            state <= SEND_ADDRESS;
          end
        end
        SEND_ADDRESS: begin
          if (romo) begin
            mosi_reg <= pc[shift_counter];
          end else begin
            mosi_reg <= mar[shift_counter];
          end
          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            shift_counter <= 7;
            if (rami)
              state <= SEND_DATA;
            else
              state <= RECEIVE_DATA;
          end
        end
        SEND_DATA: begin
          mosi_reg <= databus[shift_counter];
          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            cs_reg <= 1;
            state <= IDLE;
          end
        end
        RECEIVE_DATA: begin
          data_reg[shift_counter] <= miso;
          shift_counter <= shift_counter - 1;
          if (shift_counter == 0) begin
            cs_reg <= 1;
            state <= IDLE;
          end
        end
      endcase
    end
  end

  assign executing = executing_reg;
  assign rom = romo ? data_reg : 0;
  assign ram = (ramo && !romo) ? data_reg : 0;
  assign mosi = mosi_reg;

  assign cs_rom = romo ? cs_reg : 1;
  assign cs_ram = ((rami || ramo) && !romo) ? cs_reg : 1;
endmodule
