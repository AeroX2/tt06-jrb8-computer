module spi (
    input clk,
    input rst,

    input [7:0] databus,

    // Control
    input start,
    output logic done,
    input write,
    input [23:0] address,
    input address_24bit,
    output logic [7:0] data,

    // SPI
    output logic sclk,
    output logic cs,
    output logic mosi,
    input miso
);

  // Constants
  localparam READ_COMMAND = 'h03;
  localparam WRITE_COMMAND = 'h02;

  // States
  typedef enum {
    IDLE,
    SEND_COMMAND,
    SEND_ADDRESS,
    SEND_DATA,
    RECEIVE_DATA
  } State;

  // Registers
  State spi_state, spi_next_state;

  logic [ 4:0] shift_counter;
  logic [ 7:0] data_reg;

  logic        done_reg;
  logic        sclk_reg;
  logic [23:0] mosi_reg;

  // State transition and control logic
  always_ff @(posedge clk, posedge rst) begin
    if (rst) begin
      spi_state <= IDLE;

      done_reg <= 1;
      data_reg <= 0;
      shift_counter <= 0;

      sclk_reg <= 0;
    end else begin
      spi_state <= spi_next_state;
      case (spi_state)
        IDLE: begin
          done_reg <= 1;

          sclk_reg <= 0;
          shift_counter <= 0;

          if (start) begin
            done_reg <= 0;

            sclk_reg <= 0;
            shift_counter <= 7;
          end
        end
        SEND_COMMAND: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0) begin
              shift_counter <= address_24bit ? 23 : 15;
            end
          end
        end
        SEND_ADDRESS: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0) begin
              shift_counter <= 7;
            end
          end
        end
        SEND_DATA: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
          end
        end
        RECEIVE_DATA: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            data_reg[shift_counter[2:0]] <= miso;
          end
        end
      endcase
    end
  end

  always_comb begin
    mosi_reg = 0;
    spi_next_state = IDLE;

    case (spi_state)
      IDLE: begin
        if (start) spi_next_state = SEND_COMMAND;
        else spi_next_state = IDLE;
      end
      SEND_COMMAND: begin
        if (write) mosi_reg = WRITE_COMMAND;
        else mosi_reg = READ_COMMAND;
        if ((shift_counter == 0 && sclk))
          spi_next_state = SEND_ADDRESS;
        else spi_next_state = SEND_COMMAND;
      end
      SEND_ADDRESS: begin
        mosi_reg = address;
        if ((shift_counter == 0 && sclk)) begin
          if (write) spi_next_state = SEND_DATA;
          else spi_next_state = RECEIVE_DATA;
        end else spi_next_state = SEND_ADDRESS;
      end
      SEND_DATA: begin
        mosi_reg = {16'h00, databus};
        if ((shift_counter == 0 && sclk)) spi_next_state = IDLE;
        else spi_next_state = SEND_DATA;
      end
      RECEIVE_DATA: begin
        if ((shift_counter == 0 && sclk)) spi_next_state = IDLE;
        else spi_next_state = RECEIVE_DATA;
      end
    endcase
  end

  always_comb begin
    done = done_reg;
    sclk = sclk_reg;
    data = data_reg;

    cs   = 1;
    mosi = 0;
    if (spi_state != IDLE) begin
      cs = 0;

      if (spi_state != RECEIVE_DATA) mosi = mosi_reg[shift_counter];
    end
  end
endmodule
