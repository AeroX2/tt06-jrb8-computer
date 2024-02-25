module spi (
  input clk,
  input                   rst,
  input                   romo,
  input [15:0]            pc,
  output [7:0]            rom,
  input                   rami,
  input                   ramo,
  input [15:0]            mar,
  output [7:0]            ram,
  input [7:0]             databus,
  output                  executing,

  output                  sclk,
  output                  cs_rom,
  output                  cs_ram,
  output                  mosi,
  input                   miso
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

  reg romo_ped;
  reg ramo_ped;
  reg rami_ped;
  reg [15:0] pc_ped;

  always @(
    negedge clk,
    posedge rst
  ) begin
    if (rst) begin
      romo_ped <= 0;
      ramo_ped <= 0;
      rami_ped <= 0;
      pc_ped <= 0;
    end else begin
       if (romo && !romo_ped ||
        ramo && !ramo_ped ||
        rami && !rami_ped ||
        pc_ped != pc // TODO: Probably a better way of doing this
      ) begin
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

      romo_ped <= romo;
      ramo_ped <= ramo;
      rami_ped <= rami;
      pc_ped <= pc;
    end
  end

  // State transition and control logic
  always @(
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
          executing_reg <= 1;

          sclk_reg <= 0;
          cs_reg <= 1;
          mosi_reg <= 0;
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
            if (shift_counter == 0)
              state <= IDLE;
          end
        end
      endcase
    end
  end

  // Output assignments
  assign executing = executing_reg;
  assign rom = (romo) ? data_reg : 8'b0;
  assign ram = (ramo && !romo) ? data_reg : 8'b0;

  assign sclk = sclk_reg;
  assign cs_rom = (romo) ? cs_reg : 1'b1;
  assign cs_ram = ((rami || ramo) && !romo) ? cs_reg : 1'b1;

  assign mosi = (state == SEND_COMMAND || 
                 state == SEND_ADDRESS || 
                 state == SEND_DATA)
                ? mosi_reg[shift_counter] : 0;

endmodule