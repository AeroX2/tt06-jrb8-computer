module spi (
  input clk,
  input rst,

  input [7:0] databus,

  // Control
  input start,
  output logic done,
  input write,
  input [15:0] address,
  output logic [7:0] data,

  // SPI
  output logic sclk,
  output logic cs,
  output logic mosi,
  input miso
);

  // Constants
  localparam READ_COMMAND = 8'h03;
  localparam WRITE_COMMAND = 8'h02;
  
  // States
  localparam  IDLE = 0,
              SEND_COMMAND = 1,
              SEND_ADDRESS = 2,
              SEND_DATA    = 3,
              RECEIVE_DATA = 4;

  // Registers
  reg [4:0]   shift_counter;
  reg [3:0]   spi_state;
  reg [7:0]   data_reg;
  reg         done_reg;

  reg         sclk_reg;
  reg [15:0]  mosi_reg;

  // State transition and control logic
  always_ff @(posedge clk, posedge rst) begin
    if (rst) begin
      spi_state <= IDLE;

      data_reg <= 0;
      done_reg <= 0;
      shift_counter <= 0;

      sclk_reg <= 0;
      mosi_reg <= 0;
    end else if (clk) begin
      case (spi_state)
        IDLE: begin
          done_reg <= 0;
          shift_counter <= 0;

          sclk_reg <= 0;
          mosi_reg <= 0;

          if (start) begin
            spi_state <= SEND_COMMAND;

            sclk_reg <= 0;
            shift_counter <= 7;

            // This needs to set before sclk goes high
            if (write)
              mosi_reg <= WRITE_COMMAND;
            else
              mosi_reg <= READ_COMMAND;
          end
        end
        SEND_COMMAND: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0 && sclk_reg) begin
              shift_counter <= 15;
              spi_state <= SEND_ADDRESS;

              mosi_reg <= address;
            end
          end
        end
        SEND_ADDRESS: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0) begin
              shift_counter <= 7;

              spi_state <= (write) ? SEND_DATA : RECEIVE_DATA;

              if (write)
                mosi_reg <= databus;
            end
          end
        end
        SEND_DATA: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0) begin
              spi_state <= IDLE;
              done_reg <= 1;
            end
          end
        end
        RECEIVE_DATA: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            data_reg[shift_counter] <= miso;
            if (shift_counter == 0) begin
              spi_state <= IDLE;
              done_reg <= 1;
            end
          end
        end
      endcase
    end
  end

  always_comb begin
    done = done_reg;
    sclk = sclk_reg;
    data = data_reg;

    cs = 1;
    mosi = 0;
    if (spi_state != IDLE) begin
      cs = 0;

      if (spi_state != RECEIVE_DATA)
        mosi = mosi_reg[shift_counter];
    end
  end
endmodule