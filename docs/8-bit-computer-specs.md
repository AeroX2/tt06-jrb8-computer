#  CU Flags

| Output flags | Input flags |
| :---- | :---- |
| Input Register Out (IO) A Register Out B Register Out C Register Out D Register Out Program Memory Out (ROMO) RAM Out (RAMO) | Instruction Register In (IRI) Output register In (OI) RAM Register In (RAMI) Program Counter Low In (PCLI) Program Counter High In (PCHI) Memory Address Register In (MARI) Memory Page Register In (MPAGE) A Register In (AI) B Register In (BI) C Register In (CI) D Register In (DI) |

# Instructions

More specifications as to which flags are turned on for each instruction can be found here  
[CU/JMP Rom Expanded](https://docs.google.com/spreadsheets/d/14_HDyTmz21DP2HGkZThk7PPDzCLgTlTCDxfRBz3Zggg/edit#gid=0)

## Instruction specifications

     0\. **MOV** \- Move data from 1 register to another

| INDEX | OP |
| :---- | :---- |
| 0 | NOP |
| 1 | A \-\> B |
| 2 | A \-\> C |
| 3 | A \-\> D |
| 4 | B \-\> A |
| 5 | B \-\> C |
| 6 | B \-\> D |
| 7 | C \-\> A |
| 8 | C \-\> B |
| 9 | C \-\> D |
| A | D \-\> A |
| B | D \-\> B |
| C | D \-\> C |
| D |  |
| E |  |
| F |  |

1. **CMP** \- Compare register to constant  
2. **CMP** \- Compare 2 different registers, used in the JMP command

| INDEX | OP |
| :---- | :---- |
| 0 | A \<-\> 0 |
| 1 | B \<-\> 0 |
| 2 | C \<-\> 0 |
| 3 | D \<-\> 0 |
| 4 | A \<-\> 1 |
| 5 | B \<-\> 1 |
| 6 | C \<-\> 1 |
| 7 | D \<-\> 1 |
| 8 | A \<-\> \-1 |
| 9 | B \<-\> \-1 |
| A | C \<-\> \-1 |
| B | D \<-\> \-1 |
| C | A \<-\> 255 |
| D | B \<-\> 255 |
| E | C \<-\> 255 |
| F | D \<-\> 255 |
| 10 | A \<-\> A |
| 11 | A \<-\> B |
| 12 | A \<-\> C |
| 13 | A \<-\> D |
| 14 | B \<-\> A |
| 15 | B \<-\> B |
| 16 | B \<-\> C |
| 17 | B \<-\> D |
| 18 | C \<-\> A |
| 19 | C \<-\> B |
| 1A | C \<-\> C |
| 1B | C \<-\> D |
| 1C | D \<-\> A |
| 1D | D \<-\> B |
| 1E | D \<-\> C |
| 1F | D \<-\> D |

3. **JMP** \- Jump to specific rom position based upon conditions \- 16 bit Absolute jump positions

| INDEX | OP |
| :---- | :---- |
| 0 | No condition |
| 1 | \= |
| 2 | \!= |
| 3 | \< Unsigned |
| 4 | \<= Unsigned |
| 5 | \> Unsigned |
| 6 | \>= Unsigned |
| 7 | \< Signed |
| 8 | \<= Signed |
| 9 | \> Signed |
| A | \>= Signed |
| B | Z set |
| C | O set |
| D | C set |
| E | S set |
| F |  |

4. **JMP2** \- Jump to specific rom based upon conditions \- 16 bit Relative jump positions

| INDEX | OP |
| :---- | :---- |
| 0 | No condition |
| 1 | \= |
| 2 | \!= |
| 3 | \< Unsigned |
| 4 | \<= Unsigned |
| 5 | \> Unsigned |
| 6 | \>= Unsigned |
| 7 | \< Signed |
| 8 | \<= Signed |
| 9 | \> Signed |
| A | \>= Signed |
| B | Z set |
| C | O set |
| D | C set |
| E | S set |
| F |  |

   

5. **OPP** \- Basic ALU operations, zero, 1, \-1, identity  
6. **OPP** \- Extra ALU operations, incrementing, adding  
7. **OPP** \- Extra ALU operations, subtracting  
8. **OPP** \- Extra ALU operations, multiplying  
9. **OPP** \- Extra ALU operations, dividing  
10. **OPP** \- Extra ALU operations, logic  
11. **OPP** \- Extra ALU operations

| INDEX | OP | NOTES |
| :---- | :---- | :---- |
| 40 | CLR | Clears the CMP flags |
| 41 | CMP OFF | Discards any ALU flag results |
| 42 | CMP ON | Keeps the zero/overflow/carry/signed flag results from the ALU instead of discarding, this operation stays on until turned off |
| 43 | SIGNED OFF | Turns off signed mode |
| 44 | SIGNED ON | All add, subtraction and multiplication operations are done in signed mode |
| 45 | 0 |  |
| 46 | 1 |  |
| 47 | \-1 |  |
| 48 | a |  |
| 49 | b |  |
| 4A | c |  |
| 4B | d |  |
| 4C | \~a |  |
| 4D | \~b |  |
| 4E | \~c |  |
| 4F | \~d |  |
| 50 | \-a |  |
| 51 | \-b |  |
| 52 | \-c |  |
| 53 | \-d |  |
| 54 | a+1 |  |
| 55 | b+1 |  |
| 56 | c+1 |  |
| 57 | d+1 |  |
| 58 | a-1 |  |
| 59 | b-1 |  |
| 5A | c-1 |  |
| 5B | d-1 |  |
| 5C | a+b |  |
| 5D | a+c |  |
| 5E | a+d |  |
| 5F | b+a |  |
| 60 | b+c |  |
| 61 | b+d |  |
| 62 | c+a |  |
| 63 | c+b |  |
| 64 | c+d |  |
| 65 | d+a |  |
| 66 | d+b |  |
| 67 | d+c |  |
| 68 | a-b |  |
| 69 | a-c |  |
| 6A | a-d |  |
| 6B | b-a |  |
| 6C | b-c |  |
| 6D | b-d |  |
| 6E | c-a |  |
| 6F | c-b |  |
| 70 | c-d |  |
| 71 | d-a |  |
| 72 | d-b |  |
| 73 | d-c |  |
| 74 | a\*a low |  |
| 75 | a\*b low |  |
| 76 | a\*c low |  |
| 77 | a\*d low |  |
| 78 | b\*a low |  |
| 79 | b\*b low |  |
| 7A | b\*c low |  |
| 7B | b\*d low |  |
| 7C | c\*a low |  |
| 7D | c\*b low |  |
| 7E | c\*c low |  |
| 7F | c\*d low |  |
| 80 | d\*a low |  |
| 81 | d\*b low |  |
| 82 | d\*c low |  |
| 83 | d\*d low |  |
| 84 | a\*a high |  |
| 85 | a\*b high |  |
| 86 | a\*c high |  |
| 87 | a\*d high |  |
| 88 | b\*a high |  |
| 89 | b\*b high |  |
| 8A | b\*c high |  |
| 8B | b\*d high |  |
| 8C | c\*a high |  |
| 8D | c\*b high |  |
| 8E | c\*c high |  |
| 8F | c\*d high |  |
| 90 | d\*a high |  |
| 91 | d\*b high |  |
| 92 | d\*c high |  |
| 93 | d\*d high |  |
| 94 | a//b |  |
| 95 | a//c |  |
| 96 | a//d |  |
| 97 | b//a |  |
| 98 | b//c |  |
| 99 | b//d |  |
| 9A | c//a |  |
| 9B | c//b |  |
| 9C | c//d |  |
| 9D | d//a |  |
| 9E | d//b |  |
| 9F | d//c |  |
| A0 | a\&b |  |
| A1 | a\&c |  |
| A2 | a\&d |  |
| A3 | b\&c |  |
| A4 | b\&d |  |
| A5 | c\&d |  |
| A6 | a|b |  |
| A7 | a|c |  |
| A8 | a|d |  |
| A9 | b|c |  |
| AA | b|d |  |
| AB | c|d |  |
| AC |  |  |
| AD |  |  |
| AE |  |  |
| AF |  |  |

    

12. **LOAD** \- Load data from ram/rom to register

| INDEX | OP |
| :---- | :---- |
| 0 | Load ram\[a\] a |
| 1 | Load ram\[a\] b |
| 2 | Load ram\[a\] c |
| 3 | Load ram\[a\] d |
| 4 | Load ram\[b\] a |
| 5 | Load ram\[b\] b |
| 6 | Load ram\[b\] c |
| 7 | Load ram\[b\] d |
| 8 | Load ram\[c\] a |
| 9 | Load ram\[c\] b |
| A | Load ram\[c\] c |
| B | Load ram\[c\] d |
| C | Load ram\[d\] a |
| D | Load ram\[d\] b |
| E | Load ram\[d\] c |
| F | Load ram\[d\] d |

13. **LOAD2** \- Load data from ram/rom to register

| INDEX | OP |
| :---- | :---- |
| 0 | Load rom a {number} |
| 1 | Load rom b {number} |
| 2 | Load rom c {number} |
| 3 | Load rom d {number} |
| 4 | Load ram\[{number}\] a |
| 5 | Load ram\[{number}\] b |
| 6 | Load ram\[{number}\] c |
| 7 | Load ram\[{number}\] d |
| 8 | Set a ram page |
| 9 | Set b ram page |
| A | Set c ram page |
| B | Set d ram page |

    

14. **SAVE** \- Save data to the ram and set the ram address

| INDEX | OP |
| :---- | :---- |
| 0 | Save a mar |
| 1 | Save b mar |
| 2 | Save c mar |
| 3 | Save d mar |
| 4 | Save a ram |
| 5 | Save b ram |
| 6 | Save c ram |
| 7 | Save d ram |
| 8 | Save a ram\[a\] |
| 9 | Save b ram\[b\] |
| A | Save c ram\[c\] |
| B | Save d ram\[d\] |
| C | Save a ram\[{number}\] |
| D | Save b ram\[{number}\] |
| E | Save c ram\[{number}\] |
| F | Save d ram\[{number}\] |

    

15. **IN/OUT** \- Read from input/output register to another register

| INDEX | OP |
| :---- | :---- |
| 0 | IO \-\> AI |
| 1 | IO \-\> BI |
| 2 | IO \-\> CI |
| 3 | IO \-\> DI |
| 4 | AO \-\> OI |
| 5 | BO \-\> OI |
| 6 | CO \-\> OI |
| 7 | DO \-\> OI |
| F | HALT |

