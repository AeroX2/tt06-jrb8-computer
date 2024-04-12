module alu (
    input clk,
    input rst,

    // Control
    input start,
    output logic done,

    // Inputs
    input [7:0] a,
    input [7:0] b,
    input [7:0] cins,
    input oe,
    input carryin,

    // Outputs
    output logic carryout,
    output [7:0] aluout,
    output overout,
    output cmpo
);
  localparam CLR_CMP_INS = 'h50;
  localparam CMP_OFF_INS = 'h51;
  localparam CMP_ON_INS = 'h52;
  localparam SIGN_OFF_INS = 'h53;
  localparam SIGN_ON_INS = 'h54;

  reg [9:0] alu_rom[0:255];
  initial begin
    $readmemh("../rom/alu_rom.mem", alu_rom);
  end

  logic done_reg;

  logic [9:0] val;
  wire za = val[0];
  wire ia = val[1];
  wire zb = val[2];
  wire ib = val[3];
  wire io = val[4];
  wire po = val[5];
  wire high = val[6];
  wire cmp = val[7];
  wire [1:0] cselect = val[9:8];

  logic [7:0] aandz;
  logic [7:0] bandz;

  logic [7:0] xora;
  logic [7:0] xorb;

  logic [8:0] full_sum;
  logic [7:0] muxoutput;

  logic [15:0] mult;

  wire carried = cmp_mode && carryin;

  typedef enum {
    IDLE,
    DECODE,
    ANDZ,
    XORZ,
    SUM,
    AND,
    MULT,
    DIV,
    INVERT
  } State;

  State state, next_state;
  logic cmp_mode, signed_mode;
  always_ff @(posedge clk, posedge rst) begin
    if (rst) begin
      state <= IDLE;

      done_reg <= 1;
      cmp_mode <= 0;
      signed_mode <= 0;

      val <= 0;

      aandz <= 0;
      bandz <= 0;

      xora <= 0;
      xorb <= 0;

      muxoutput <= 0;
    end else if (clk) begin
      state <= next_state;
      case (state)
        IDLE: begin
          if (cins == CMP_OFF_INS) begin
            done_reg <= ~done_reg;
            cmp_mode <= 0;
          end else if (cins == CMP_ON_INS) begin
            done_reg <= ~done_reg;
            cmp_mode <= 1;
          end else if (cins == SIGN_OFF_INS) begin
            done_reg <= ~done_reg;
            signed_mode <= 0;
          end else if (cins == SIGN_ON_INS) begin
            done_reg <= ~done_reg;
            signed_mode <= 1;
          end else if (start) done_reg <= 0;
          else done_reg <= 1;
        end
        DECODE: begin
          val <= alu_rom[cins];
        end
        ANDZ: begin
          aandz <= za ? 0 : a;
          bandz <= zb ? 0 : b;
        end
        XORZ: begin
          xora <= aandz ^ {8{ia}};
          xorb <= bandz ^ {8{ib}};
        end
        SUM: begin
          muxoutput <= full_sum[7:0];
        end
        AND: begin
          muxoutput <= xora & xorb;
        end
        MULT: begin
          muxoutput <= high ? mult[15:8] : mult[7:0];
        end
        DIV: begin
          if (signed_mode) begin
            muxoutput <= $signed(xora) /
                $signed((xorb == 8'h0 ? 8'h1 : xorb));
          end else begin
            muxoutput <= xora / (xorb == 8'h0 ? 8'h1 : xorb);
          end
        end
        INVERT: begin
          muxoutput <= muxoutput ^ {8{io}};
        end
      endcase
    end
  end

  always_comb begin
    done = done_reg;
    next_state = IDLE;

    // TODO: Is there a way to avoid calculating this on every clock cycle?
    mult = signed_mode ? $signed(xora) * $signed(xorb) : xora * xorb;
    full_sum = xora + xorb + {8'b0, po} + {8'b0, (cmp_mode && cmp) ? carried : 1'b0};

    case (state)
      IDLE: begin
        if (start) next_state = DECODE;
        else next_state = IDLE;
      end
      DECODE: begin
        next_state = ANDZ;
      end
      ANDZ: begin
        next_state = XORZ;
      end
      XORZ: begin
        case (cselect)
          0: next_state = SUM;
          1: next_state = AND;
          2: next_state = MULT;
          3: next_state = DIV;
        endcase
      end
      SUM: begin
        next_state = INVERT;
      end
      AND: begin
        next_state = INVERT;
      end
      MULT: begin
        next_state = INVERT;
      end
      DIV: begin
        next_state = INVERT;
      end
      INVERT: begin
        next_state = IDLE;
      end
    endcase
  end

  assign aluout = oe ? muxoutput : 0;
  assign cmpo = (cmp || cins == CLR_CMP_INS) && state == INVERT;

  // TODO: (ia | ib) & po seems a little
  assign carryout = cselect == 0 ? (((ia | ib) & po) ? !full_sum[8] : full_sum[8]) : 0;
  assign overout = ((~muxoutput[7]) & xora[7] & xorb[7]) | (muxoutput[7] & ~xora[7] & ~xorb[7]);
endmodule
