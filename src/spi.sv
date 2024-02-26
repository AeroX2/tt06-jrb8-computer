module spi (
  input clk,
  input rst,

  // ROM
  input romo,
  input [15:0] pc,
  output logic [7:0] rom,

  // RAM
  input rami,
  input ramo,
  input [15:0] mar,
  output logic [7:0] ram,

  input [7:0] databus,
  output logic executing,

  // SPI
  output logic sclk,
  output logic cs_rom,
  output logic cs_ram,
  output logic mosi,
  input miso
);

  // Constants
  localparam READ_COMMAND = 8'h03;
  localparam WRITE_COMMAND = 8'h02;
  
  // States
  localparam IDLE = 0,
            SEND_COMMAND = 1,
            SEND_ADDRESS = 2,
            SEND_DATA    = 3,
            RECEIVE_DATA = 4;

  // Registers
  reg [4:0]   shift_counter;
  reg [3:0]   state;
  reg [7:0]   data_reg;
  reg         executing_reg;

  reg         sclk_reg;
  reg         cs_reg;
  reg [15:0]  mosi_reg;

  reg begin_transaction;

  // Positive edge detectors
  // reg romo_ped;
  logic [15:0] pc_pre;
  logic [15:0] mar_pre;

  always_ff @(
    negedge clk,
    posedge rst
  ) begin
    if (rst) begin
      pc_pre <= -1;
      mar_pre <= -1;
      begin_transaction <= 0;
    end else begin
      begin_transaction <= 0;

      if (
        (pc != pc_pre) && romo ||
        (mar != mar_pre) && (rami || ramo)
      ) begin
        pc_pre <= pc;
        mar_pre <= mar;
        begin_transaction <= 1;
      end
    end
  end

  // State transition and control logic
  always_ff @(
    posedge clk,
    posedge rst
  ) begin
    if (rst) begin
      state <= IDLE;

      data_reg <= 0;
      executing_reg <= 0;
      shift_counter <= 0;

      sclk_reg <= 0;
      cs_reg <= 1;
      mosi_reg <= 0;
    end else if (clk) begin
      case (state)
        IDLE: begin
          sclk_reg <= 0;
          cs_reg <= 1;
          mosi_reg <= 0;

          if (begin_transaction) begin
            // Stop execution of the computer
            executing_reg <= 0;

            state <= SEND_COMMAND;

            sclk_reg <= 0;
            cs_reg <= 0;
            shift_counter <= 7;

            // This needs to set before sclk goes high
            if (rami)
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
              state <= SEND_ADDRESS;

              mosi_reg <= (romo) ? pc : mar;
            end
          end
        end
        SEND_ADDRESS: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0) begin
              shift_counter <= 7;
              state <= (rami) ? SEND_DATA : RECEIVE_DATA;

              if (rami)
                mosi_reg <= databus;
            end
          end
        end
        SEND_DATA: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            if (shift_counter == 0) 
              state <= IDLE;
          end
        end
        RECEIVE_DATA: begin
          sclk_reg <= ~sclk_reg;
          if (sclk_reg) begin
            shift_counter <= shift_counter - 1;
            data_reg[shift_counter] <= miso;
            if (shift_counter == 0) begin
              state <= IDLE;
              executing_reg <= 1;
            end
          end
        end
      endcase
    end
  end

  always_comb begin
    executing = executing_reg;
    sclk = sclk_reg;

    rom = (romo) ? data_reg : 8'b0;
    ram = (ramo && !romo) ? data_reg : 8'b0;

    cs_rom = 1;
    cs_ram = 1;
    if (state == SEND_COMMAND) begin
      if (romo)
        cs_rom = cs_reg;
      
      if (rami || ramo)
        cs_ram = cs_reg;
    end

    case (state)
      SEND_COMMAND,
      SEND_ADDRESS,
      SEND_DATA:
        mosi = mosi_reg[shift_counter];
      default:
        mosi = 0;
    endcase
  end
endmodule