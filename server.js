const express = require('express')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const markdownIt = require('markdown-it');
const md = markdownIt();

const app = express()
app.use(cors())
app.use(express.json())

app.use('/public', express.static(path.join(__dirname, 'public')))

app.post('/generate-pdf', async (req, res) => {
  const markdown = req.body.markdown;

  // Prüfen, ob Markdown eine Tabelle enthält
  const html = md.render(markdown);
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/);
  let tableData = null;
  if (tableMatch) {
    // Tabelle extrahieren und in 2D-Array umwandeln
    const cheerio = require('cheerio');
    const $ = cheerio.load(tableMatch[0]);
    tableData = [];
    $('tr').each((i, row) => {
      const rowData = [];
      $(row).find('th, td').each((j, cell) => {
        rowData.push($(cell).text());
      });
      tableData.push(rowData);
    });
  }

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const { width, height } = page.getSize()

  const logoPath = path.join(__dirname, 'public', 'logo.png')
  if (!fs.existsSync(logoPath)) {
    return res.status(500).send('Logo file not found at ' + logoPath)
  }
  const logoBytes = fs.readFileSync(logoPath)
  if (!logoBytes || logoBytes.length === 0) {
    return res.status(500).send('Logo file is empty or corrupted at ' + logoPath)
  }
  const logoImage = await pdfDoc.embedPng(logoBytes)

  // Logo mittig oben, größere und bessere Qualität
  const logoWidth = 120;
  const logoHeight = 55;
  const logoX = (width - logoWidth) / 2;
  const logoY = height - 80;
  page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  // Firmenname mittig unter dem Logo, mit zwei Leerzeilen Abstand
  page.drawText(sanitizeText('Test-KV für Beispielfälle'), {
    x: width / 2 - 50,
    y: logoY - 40, // Abstand für zwei Leerzeilen
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  // Adresszeile links
  page.drawText(sanitizeText('Testkunde'), {
    x: 40,
    y: logoY - 60,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('49134 Wallenhorst'), {
    x: 40,
    y: logoY - 75,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Rechte Seite: Patientendaten etc. (tiefer positioniert)
  const patientBlockY = logoY - 60;
  page.drawText(sanitizeText('Patienten-Name'), {
    x: 350,
    y: patientBlockY,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('Mustermann'), {
    x: 470,
    y: patientBlockY,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('Beleg-Nr.:'), {
    x: 350,
    y: patientBlockY - 18,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('2025.05.00006'), {
    x: 470,
    y: patientBlockY - 18,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('Beleg-Datum:'), {
    x: 350,
    y: patientBlockY - 33,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('27.05.2025'), {
    x: 470,
    y: patientBlockY - 33,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('Kunden-Nr.:'), {
    x: 350,
    y: patientBlockY - 48,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('50000'), {
    x: 470,
    y: patientBlockY - 48,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('Kostenträger:'), {
    x: 350,
    y: patientBlockY - 63,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('GKV'), {
    x: 470,
    y: patientBlockY - 63,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Arbeitsart und Zahnfarbe links unter Adresszeile
  page.drawText(sanitizeText('Arbeitsart'), {
    x: 40,
    y: logoY - 110,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('PLATZHALTER'), {
    x: 110,
    y: logoY - 110,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(sanitizeText('Zahnfarbe, -form'), {
    x: 40,
    y: logoY - 125,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Überschrift Kostenplan mittig, eigene Zeile, Leerzeile danach
  const kostenplanY = logoY - 150;
  page.drawText(sanitizeText('Kostenplan'), {
    x: width / 2 - 50,
    y: kostenplanY,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  // Body: Markdown-Text unter Kostenplan mit Leerzeile
  const bodyY = kostenplanY - 30;
  let y = bodyY;
  const minFontSize = 8;
  const maxWidth = 500;

  // Hilfsfunktion für Zeilenumbruch in Tabellenzellen
  function wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  // Markdown in Blöcke zerlegen (Text, Überschrift, Tabelle)
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const blocks = [];
  $('body').children().each((i, el) => {
    if (el.tagName === 'h1' || el.tagName === 'h2' || el.tagName === 'h3') {
      blocks.push({ type: 'heading', level: Number(el.tagName[1]), text: $(el).text() });
    } else if (el.tagName === 'p') {
      blocks.push({ type: 'paragraph', text: $(el).text() });
    } else if (el.tagName === 'table') {
      // Tabelle in 2D-Array
      const table = [];
      $(el).find('tr').each((i, row) => {
        const rowData = [];
        $(row).find('th, td').each((j, cell) => {
          rowData.push($(cell).text());
        });
        table.push(rowData);
      });
      blocks.push({ type: 'table', table });
    } else if (el.type === 'text' && $(el).text().trim() !== '') {
      blocks.push({ type: 'paragraph', text: $(el).text() });
    }
  });

  // Blöcke nacheinander ins PDF schreiben
  blocks.forEach(block => {
    if (block.type === 'heading') {
      let size = 18 - (block.level - 1) * 2;
      if (size < 10) size = 10;
      page.drawText(sanitizeText(block.text), {
        x: 40,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
      });
      y -= size + 8;
    } else if (block.type === 'paragraph') {
      let size = 12;
      const lines = wrapText(sanitizeText(block.text), font, size, maxWidth);
      lines.forEach(line => {
        page.drawText(sanitizeText(line), {
          x: 40,
          y,
          size,
          font,
          color: rgb(0, 0, 0),
        });
        y -= size + 2;
      });
      y -= 4;
    } else if (block.type === 'table') {
      // Dynamische Schriftgröße, aber nicht kleiner als minFontSize
      let fontSize = 12;
      if (block.table.length > 10 || block.table[0].length > 5) fontSize = 9;
      if (fontSize < minFontSize) fontSize = minFontSize;
      // Spaltenbreiten individuell anpassen, damit "E-Preis" weiter rechts steht
      let colWidths;
      if (block.table[0].length === 5) {
        // Beispiel: 5 Spalten wie in deiner Tabelle
        colWidths = [70, 50, 180, 80, 80];
      } else {
        // Gleichmäßige Verteilung für andere Tabellen
        colWidths = Array(block.table[0].length).fill(maxWidth / block.table[0].length);
      }
      block.table.forEach((row, i) => {
        let rowHeight = fontSize + 4;
        // Zeilenumbruch für jede Zelle berechnen
        const wrappedCells = row.map((cell, idx) => wrapText(sanitizeText(cell), font, fontSize, colWidths[idx] - 4));
        const maxLines = Math.max(...wrappedCells.map(lines => lines.length));
        rowHeight = maxLines * (fontSize + 2);
        let x = 40;
        for (let j = 0; j < row.length; j++) {
          const lines = wrappedCells[j];
          for (let l = 0; l < lines.length; l++) {
            page.drawText(sanitizeText(lines[l]), {
              x: x,
              y: y - l * (fontSize + 2),
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0)
            });
          }
          x += colWidths[j];
        }
        y -= rowHeight + 2;
      });
      y -= 6;
    }
  });

  const pdfBytes = await pdfDoc.save()
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="kostenplan.pdf"')
  res.send(Buffer.from(pdfBytes))
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Hilfsfunktion zum Ersetzen nicht unterstützter Zeichen
function sanitizeText(text) {
  // Ersetze schmales geschütztes Leerzeichen (U+202F) durch normales Leerzeichen
  return text.replace(/\u202F/g, ' ');
}
