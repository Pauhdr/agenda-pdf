#!/usr/bin/env python3
"""
Regenera las fuentes de fonts/ a partir de los originales. Solo hace falta si cambias de fuente
o necesitas más caracteres. Requiere: pip install fonttools

  python3 scripts/build-fonts.py TeXGyreChorus-MediumItalic.otf Poppins-Regular.ttf

- agenda-script.ttf: TeX Gyre Chorus (GUST Font License), pasada de contornos CFF a TrueType,
  recortada al alfabeto latino y renombrada, como pide la licencia para obras derivadas.
- agenda-sans.ttf: Poppins Regular (SIL Open Font License 1.1), recortada al alfabeto latino.
"""
import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import subset

UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x2039, 0x203A]


def cff_to_truetype(font):
    glyph_set = font.getGlyphSet()
    glyphs = {}
    for name in font.getGlyphOrder():
        pen = TTGlyphPen(glyph_set)
        glyph_set[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyphs[name] = pen.glyph()
    font["loca"] = newTable("loca")
    glyf = newTable("glyf")
    glyf.glyphOrder = font.getGlyphOrder()
    glyf.glyphs = glyphs
    font["glyf"] = glyf
    del font["CFF "]
    if "VORG" in font:
        del font["VORG"]
    font.sfntVersion = "\x00\x01\x00\x00"
    maxp = font["maxp"]
    maxp.tableVersion = 0x00010000
    for attr in ["maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs",
                 "maxStackElements", "maxSizeOfInstructions", "maxComponentElements", "maxPoints",
                 "maxContours", "maxCompositePoints", "maxCompositeContours", "maxComponentDepth"]:
        setattr(maxp, attr, 0)
    maxp.maxZones = 1
    font["head"].indexToLocFormat = 0
    font["head"].glyphDataFormat = 0
    font["post"].formatType = 2.0
    font["post"].extraNames = []
    font["post"].mapping = {}


def do_subset(font):
    opts = subset.Options()
    opts.hinting = False
    opts.notdef_outline = True
    opts.name_IDs = ["*"]
    opts.layout_features = []
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)


def main(script_src, sans_src):
    script = TTFont(script_src)
    if "CFF " in script:
        cff_to_truetype(script)
    do_subset(script)
    for rec in script["name"].names:
        if rec.nameID in (1, 4, 16, 21):
            rec.string = "Agenda Script"
        elif rec.nameID in (3, 6):
            rec.string = "AgendaScript-Regular"
        elif rec.nameID == 2:
            rec.string = "Regular"
    script["name"].setName("Derived from TeX Gyre Chorus (GUST Font License): converted to TrueType outlines and subset to Latin for Agenda PDF.", 10, 3, 1, 0x409)
    script.save("fonts/agenda-script.ttf")

    sans = TTFont(sans_src)
    do_subset(sans)
    sans.save("fonts/agenda-sans.ttf")
    print("Fuentes generadas en fonts/")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
