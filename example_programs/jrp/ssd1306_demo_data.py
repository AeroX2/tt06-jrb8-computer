"""Build the data image consumed by ssd1306_demo.jrp."""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


FRAMES = 40
SCALE = 12
ROTATION_PAGE = 1
LOOKUP_PAGE = 2
VELOCITY_PAGE = 12
FONT_PAGE = 13
MESSAGE = "JRB8 - 8-BIT CPU"
VERTICES = (
    (-1, -1, -1),
    (1, -1, -1),
    (1, 1, -1),
    (-1, 1, -1),
    (-1, -1, 1),
    (1, -1, 1),
    (1, 1, 1),
    (-1, 1, 1),
)
EDGES = (
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 0),
    (4, 5),
    (5, 6),
    (6, 7),
    (7, 4),
    (0, 4),
    (1, 5),
    (2, 6),
    (3, 7),
)


def rotation_tables() -> list[list[int]]:
    axis = (1.0, 1.0, 1.0)
    norm = math.sqrt(sum(component * component for component in axis))
    kx, ky, kz = (component / norm for component in axis)
    tables = [[0] * FRAMES for _ in range(6)]
    for frame in range(FRAMES):
        angle = 2 * math.pi * frame / FRAMES + 0.7
        cosine, sine = math.cos(angle), math.sin(angle)
        complement = 1 - cosine
        matrix = (
            (cosine + kx * kx * complement, kx * ky * complement - kz * sine, kx * kz * complement + ky * sine),
            (ky * kx * complement + kz * sine, cosine + ky * ky * complement, ky * kz * complement - kx * sine),
        )
        for row in range(2):
            for column in range(3):
                tables[row * 3 + column][frame] = round(SCALE * matrix[row][column]) & 0xFF
    return tables


def velocity_table() -> list[tuple[int, int]]:
    result = []
    for index in range(24):
        angle = 2 * math.pi * index / 24
        speed = 1 + index % 2
        vx = round(speed * math.cos(angle)) or (1 if index % 2 else -1)
        vy = round(speed * math.sin(angle)) or (1 if index % 3 else -1)
        result.append((vx & 0xFF, vy & 0xFF))
    return result


def title_bitmap() -> bytes:
    try:
        font = ImageFont.truetype("arial.ttf", 8)
    except OSError:
        font = ImageFont.load_default()
    result = bytearray(128)
    for position, character in enumerate(MESSAGE):
        image = Image.new("1", (8, 8), 0)
        ImageDraw.Draw(image).text((0, -1), character, fill=1, font=font)
        pixels = image.load()
        for column in range(8):
            value = 0
            for row in range(8):
                if pixels[column, row]:
                    value |= 1 << row
            result[position * 8 + column] = value
    return bytes(result)


def build() -> bytes:
    image = bytearray(256 * (FONT_PAGE + 1))
    base = ROTATION_PAGE * 256
    for table_index, table in enumerate(rotation_tables()):
        image[base + table_index * FRAMES : base + (table_index + 1) * FRAMES] = bytes(table)

    base = LOOKUP_PAGE * 256
    for y in range(64):
        image[base + y] = (y >> 3) + 3
        image[base + 64 + y] = 1 << (y & 7)
    for edge_index, (start, end) in enumerate(EDGES):
        image[base + 151 + edge_index * 2] = start
        image[base + 152 + edge_index * 2] = end

    base = VELOCITY_PAGE * 256
    for index, (vx, vy) in enumerate(velocity_table()):
        image[base + index * 2] = vx
        image[base + index * 2 + 1] = vy

    base = FONT_PAGE * 256
    image[base : base + 128] = title_bitmap()
    return bytes(image)


if __name__ == "__main__":
    output = Path(__file__).with_name("ssd1306_demo_data.bin")
    data = build()
    output.write_bytes(data)
    print(f"Wrote {len(data)} bytes to {output}")
