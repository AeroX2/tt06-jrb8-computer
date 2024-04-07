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

  logic [ 3:0] shift_counter;
  logic [ 7:0] data_reg;

  logic        done_reg;
  logic        sclk_reg;
  logic [15:0] mosi_reg;

  // State transition and control logic
  always_ff @(posedge clk, posedge rst) begin
    if (rst) begin
      spi_state <= IDLE;

      done_reg <= 1;
      data_reg <= 0;
      shift_counter <= 0;

      sclk_reg <= 0;
    end else if (clk) begin
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
              shift_counter <= 15;
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
            data_reg[shift_counter] <= miso;
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
        spi_next_state = State'(start ? SEND_COMMAND : IDLE);
      end
      SEND_COMMAND: begin
        if (write) mosi_reg = WRITE_COMMAND;
        else mosi_reg = READ_COMMAND;
        spi_next_state = State'((shift_counter == 0 && sclk) ? SEND_ADDRESS : SEND_COMMAND);
      end
      SEND_ADDRESS: begin
        mosi_reg = address;
        spi_next_state = State'((shift_counter == 0 && sclk) ? ((write) ? SEND_DATA : RECEIVE_DATA) : SEND_ADDRESS);
      end
      SEND_DATA: begin
        mosi_reg = {8'h00, databus};
        spi_next_state = State'((shift_counter == 0 && sclk) ? IDLE : SEND_DATA);
      end
      RECEIVE_DATA: begin
        spi_next_state = State'((shift_counter == 0 && sclk) ? IDLE : RECEIVE_DATA);
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
