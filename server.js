const express = require('express')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const cors = require('cors')
const markdownIt = require('markdown-it');
const md = markdownIt();
const axios = require('axios'); // <-- axios global importieren

const app = express()
app.use(cors())
app.use(express.json())

app.use('/public', express.static(path.join(__dirname, 'public')))

app.post('/generate-pdf', async (req, res) => {
  const markdown = req.body.markdown;
  const useridentifier = req.body.email;

  // Log the incoming markdown data
  console.log('Received markdown:', markdown);

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

  // === HEADER: Logo, Firmenname, Adresszeile, Patientendaten, Tabellenkopf ===
  // Logo mittig oben, größere und bessere Qualität
  const logoWidth = 120;
  const logoHeight = 50;
  const logoX = (width - logoWidth) / 2;
  const logoY = height - 60;
  page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  // Firmenname mittig unter dem Logo, mit zwei Leerzeilen Abstand
  page.drawText(sanitizeText(''), {
    x: width / 2 - 50,
    y: logoY - 40, // Abstand für zwei Leerzeilen
    size: 16, // vorher 17
    font,
    color: rgb(0, 0, 0),
  });

  // === 1. Adresszeile mit Unterstreichung und Abrechnungsnummer ===
  // Seitenränder definieren
  const marginLeft = 40;
  const marginRight = 40;
  const addressLineY = logoY - 30;
  const addressText = sanitizeText('Musterstraße 1, 12345 Musterstadt'); // Platzhalter für Adresse
  const abrechnungsNr = '30628'; // Platzhalter für Abrechnungsnummer

  // Adresszeile links
  page.drawText(addressText, {
    x: marginLeft,
    y: addressLineY,
    size: 10, // vorher 11
    font,
    color: rgb(0, 0, 0),
  });
  // Abrechnungsnummer rechts
  const abrechnungsLabel = 'Abrechnungs-Nr.:';
  const abrechnungsText = `${abrechnungsLabel} ${abrechnungsNr}`;
  const abrechnungsWidth = font.widthOfTextAtSize(abrechnungsText, 10); // vorher 11
  page.drawText(abrechnungsText, {
    x: width - marginRight - abrechnungsWidth,
    y: addressLineY,
    size: 10, // vorher 11
    font,
    color: rgb(0, 0, 0),
  });
  // Unterstreichung (Linie von links nach rechts)
  page.drawLine({
    start: { x: marginLeft, y: addressLineY - 3 },
    end: { x: width - marginRight, y: addressLineY - 3 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // === 2. Tabelle: 2 Spalten (Adresse & Patientendaten) ===
  const table2Y = addressLineY - 25;
  const colWidth2 = (width - marginLeft - marginRight) / 2;
  // Linke Spalte: Adresse (5 Zeilen)
  const addressLines = [
    'Herrn',
    'Max Mustermann',
    'Musterstraße 1',
    '12345 Musterstadt',
    'Deutschland',
  ];
  addressLines.forEach((line, i) => {
    page.drawText(sanitizeText(line), {
      x: marginLeft,
      y: table2Y - i * 14,
      size: 10, // vorher 11
      font,
      color: rgb(0, 0, 0),
    });
  });
  // Rechte Spalte: Patientendaten
  const patientName = 'Platzhalter';
  page.drawText('Patientenname: ' + patientName, {
    x: marginLeft + colWidth2 + 10,
    y: table2Y,
    size: 10, // vorher 11
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Dieses Produkt ist ausschließlich', {
    x: marginLeft + colWidth2 + 10,
    y: table2Y - 18,
    size: 8, // vorher 9
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('für Patient ' + patientName + ' gedacht.', {
    x: marginLeft + colWidth2 + 10,
    y: table2Y - 18 - 12, // 12pt Abstand zur nächsten Zeile
    size: 8, // vorher 9
    font,
    color: rgb(0, 0, 0),
  });

  // === 3. Tabelle: 5 Spalten (1 große, 4 kleine) ===
  const table3Y = table2Y - 80;
  const leftHalf = (width - marginLeft - marginRight) / 2;
  const rightHalf = (width - marginLeft - marginRight) / 2;
  const colWidth3 = rightHalf / 4;
  // Linke große Spalte
  page.drawText('Beleg-Nr.: 2025.05.00005', {
    x: marginLeft,
    y: table3Y,
    size: 10, // vorher 11
    font,
    color: rgb(0, 0, 0),
  });
  // Rechte 4 Spalten
  const table3Headers = ['Lieferdatum', 'Belegdatum', 'Herstellungsort', ''];
  const table3Values = ['27.05.2025', '27.05.2025', 'DE', ''];
  const boldFont3 = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 4; i++) {
    page.drawText(table3Headers[i], {
      x: marginLeft + leftHalf + i * colWidth3 + 5,
      y: table3Y,
      size: 8, // vorher 9
      font: boldFont3,
      color: rgb(0, 0, 0),
    });
    page.drawText(table3Values[i], {
      x: marginLeft + leftHalf + i * colWidth3 + 5,
      y: table3Y - 14,
      size: 9, // vorher 10
      font,
      color: rgb(0, 0, 0),
    });
  }

  // === 4. Tabelle: 4 gleich breite Spalten ===
  const table4Y = table3Y - 35;
  const colWidth4 = (width - marginLeft - marginRight) / 4;
  const table4Headers = ['Versorgungsart:', 'Zahnfarbe,-form', 'Kundennummer:', 'Kostenträger:'];
  const table4Values = ['', '', '50000', 'GKV'];
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 4; i++) {
    page.drawText(table4Headers[i], {
      x: marginLeft + i * colWidth4,
      y: table4Y,
      size: 8, // vorher 9
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    page.drawText(table4Values[i], {
      x: marginLeft + i * colWidth4,
      y: table4Y - 14,
      size: 8, // vorher 9
      font,
      color: rgb(0, 0, 0),
    });
  }

  const kostenplanY = table4Y - 35;
  // === 5. Überschrift Kostenplan ===
  // Fett und kursiv: Helvetica-BoldOblique
  const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  page.drawText(sanitizeText('KI-genierter Kostenplan, Irrtümer vorbehalten, bei Unklarheiten, rufen Sie uns an.'), {
    x: marginLeft, // linksbündig
    y: kostenplanY,
    size: 10, // vorher 11
    font: boldItalicFont,
    color: rgb(0, 0, 0),
  });
  // === ENDE HEADER ===



  //Hier kommt der markdown-Text rein:




  // === BODY: Markdown-Blöcke (Text, Überschriften, Tabellen) ===
  // === 6. Body wie bisher, aber Y-Startpunkt anpassen ===
  let y = kostenplanY - 30;
  const minFontSize = 8; // Minimal zulässige Schriftgröße für Tabellen
  const maxWidth = 500; // Maximale Breite für Textumbruch in Tabellen und Absätzen
  const minY = 70; // Unterer Rand für Seitenumbruch

  // Footer-Variablen müssen vor den Hilfsfunktionen stehen!
  const footerY = 40;
  const footerColWidth = (width - marginLeft - marginRight) / 4;
  const footerTexts = [
    'Dental Labor Gerd Kock Betriebs GmbH & Co. KG',
    'Postfach 1161',
    '49125 Wallenhorst',
    'www.dentallabor-kock.de',
  ];

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

  // Hilfsfunktion: Header auf neuer Seite zeichnen
  function drawHeader(page) {
    page.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    });
    page.drawText(sanitizeText(''), {
      x: width / 2 - 50,
      y: logoY - 40,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(addressText, {
      x: marginLeft,
      y: addressLineY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    const abrechnungsText = `${abrechnungsLabel} ${abrechnungsNr}`;
    const abrechnungsWidth = font.widthOfTextAtSize(abrechnungsText, 10);
    page.drawText(abrechnungsText, {
      x: width - marginRight - abrechnungsWidth,
      y: addressLineY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: marginLeft, y: addressLineY - 3 },
      end: { x: width - marginRight, y: addressLineY - 3 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    // 2. Tabelle: Adresse & Patientendaten
    addressLines.forEach((line, i) => {
      page.drawText(sanitizeText(line), {
        x: marginLeft,
        y: table2Y - i * 14,
        size: 10,
        font,
        color: rgb(0, 0, 0),
      });
    });
    page.drawText('Patientenname: ' + patientName, {
      x: marginLeft + colWidth2 + 10,
      y: table2Y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText('Dieses Produkt ist ausschließlich', {
      x: marginLeft + colWidth2 + 10,
      y: table2Y - 18,
      size: 8,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText('für Patient ' + patientName + ' gedacht.', {
      x: marginLeft + colWidth2 + 10,
      y: table2Y - 18 - 12,
      size: 8,
      font,
      color: rgb(0, 0, 0),
    });
    // 3. Tabelle
    page.drawText('Beleg-Nr.: 2025.05.00005', {
      x: marginLeft,
      y: table3Y,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });
    for (let i = 0; i < 4; i++) {
      page.drawText(table3Headers[i], {
        x: marginLeft + leftHalf + i * colWidth3 + 5,
        y: table3Y,
        size: 8,
        font: boldFont3,
        color: rgb(0, 0, 0),
      });
      page.drawText(table3Values[i], {
        x: marginLeft + leftHalf + i * colWidth3 + 5,
        y: table3Y - 14,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });
    }
    // 4. Tabelle
    for (let i = 0; i < 4; i++) {
      page.drawText(table4Headers[i], {
        x: marginLeft + i * colWidth4,
        y: table4Y,
        size: 8,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      page.drawText(table4Values[i], {
        x: marginLeft + i * colWidth4,
        y: table4Y - 14,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });
    }
    // Überschrift Kostenplan
    page.drawText(sanitizeText('KI-genierter Kostenplan, Irrtümer vorbehalten, bei Unklarheiten, rufen Sie uns an.'), {
      x: marginLeft,
      y: kostenplanY,
      size: 10,
      font: boldItalicFont,
      color: rgb(0, 0, 0),
    });
  }

  // Hilfsfunktion: Footer auf neuer Seite zeichnen
  function drawFooter(page) {
    // Erste Spalte: Text untereinander
    const footerFirstColLines = [
      'Dental Labor Gerd Kock',
      'Betriebs GmbH & Co. KG'
    ];
    for (let l = 0; l < footerFirstColLines.length; l++) {
      page.drawText(footerFirstColLines[l], {
        x: marginLeft,
        y: footerY - l * 10, // 10pt Abstand zwischen den Zeilen
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    // Restliche Spalten wie gehabt
    for (let i = 1; i < 4; i++) {
      page.drawText(footerTexts[i], {
        x: marginLeft + i * footerColWidth,
        y: footerY,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }

  // Hilfsfunktion: Seitenumbruch
  function addNewPage() {
    const newPage = pdfDoc.addPage([width, height]);
    drawHeader(newPage);
    drawFooter(newPage);
    return newPage;
  }

  // Initial Header/Footer auf erster Seite
  drawHeader(page);
  // Footer auf erster Seite: erste Spalte untereinander
  const footerFirstColLines = [
    'Dental Labor Gerd Kock',
    'Betriebs GmbH & Co. KG'
  ];
  for (let l = 0; l < footerFirstColLines.length; l++) {
    page.drawText(footerFirstColLines[l], {
      x: marginLeft,
      y: footerY - l * 10,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
  for (let i = 1; i < 4; i++) {
    page.drawText(footerTexts[i], {
      x: marginLeft + i * footerColWidth,
      y: footerY,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  let currentPage = page;
  y = kostenplanY - 30;
  let pageCount = 1;

  // Markdown in Blöcke zerlegen (Text, Überschrift, Tabelle)
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const blocks = [];
  $('body').children().each((i, el) => {
    if (el.tagName === 'h1' || el.tagName === 'h2' || el.tagName === 'h3') {
      blocks.push({ type: 'heading', level: Number(el.tagName[1]), text: $(el).text() });
    } else if (el.tagName === 'p') {
      const text = $(el).text();
      if (!text.trim().startsWith('Frage:')) { // Absatz überspringen, wenn er mit Frage: beginnt
        blocks.push({ type: 'paragraph', text });
      }
    } else if (el.tagName === 'table') {
      // Tabelle in 2D-Array
      const table = [];
      $(el).find('tr').each((i, row) => {
        const rowData = [];
        $(row).find('th, td').each((j, cell) => {
          let cellText = $(cell).text();
          if (cellText.trim().startsWith('Frage:')) {
            cellText = '';
          }
          rowData.push(cellText);
        });
        // Nur Zeilen übernehmen, die nicht komplett aus Frage:-Zellen bestehen
        if (rowData.some(cell => cell.trim() !== '')) {
          table.push(rowData);
        }
      });
      if (table.length > 0) {
        blocks.push({ type: 'table', table });
      }
    } else if (el.type === 'text' && $(el).text().trim() !== '') {
      const text = $(el).text();
      if (!text.trim().startsWith('Frage:')) {
        blocks.push({ type: 'paragraph', text });
      }
    }
  });

  // Blöcke nacheinander ins PDF schreiben
  let lastHeading = null;
  blocks.forEach(block => {
    // Hilfsfunktion: Platzbedarf schätzen
    function estimateBlockHeight(block, useSmallFont) {
      if (block.type === 'heading') {
        let size = 18 - (block.level - 1) * 2;
        if (size < 10) size = 10;
        return size + 10;
      } else if (block.type === 'paragraph') {
        let size = useSmallFont ? 10 : 12;
        const lines = wrapText(sanitizeText(block.text), font, size, maxWidth);
        return lines.length * (size + 0.5) + 2;
      } else if (block.type === 'table') {
        let fontSize = 12;
        if (useSmallFont || (block.table[0][0] === 'Nummer' && block.table[0][1] === 'Menge')) {
          fontSize = 10;
        } else if (block.table.length > 10 || block.table[0].length > 5) {
          fontSize = 9;
        }
        if (fontSize < minFontSize) fontSize = minFontSize;
        let colWidths;
        if (block.table[0].includes('Bezeichnung')) {
          if (block.table[0].length === 6) {
            // 6 Spalten: z.B. Nummer, Menge, Bezeichnung, Einzelpreis, Gesamtpreis, Bemerkung
            colWidths = [60, 40, 180, 70, 70, 80];
          } else {
            // Standard: 5 Spalten
            colWidths = [70, 50, 220, 80, 80];
          }
        } else if (block.table[0].length === 6) {
          colWidths = Array(6).fill(maxWidth / 6);
        } else if (block.table[0].length === 5) {
          colWidths = [70, 50, 220, 80, 80];
        } else {
          colWidths = Array(block.table[0].length).fill(maxWidth / block.table[0].length);
        }
        let totalHeight = 0;
        block.table.forEach((row) => {
          const wrappedCells = row.map((cell, idx) => wrapText(sanitizeText(cell), font, fontSize, colWidths[idx] - 4));
          const maxLines = Math.max(...wrappedCells.map(lines => lines.length));
          totalHeight += maxLines * (fontSize + 1) + 1;
        });
        totalHeight += 4;
        return totalHeight;
      }
      return 16;
    }

    // Prüfen, ob wir nach einer relevanten Überschrift sind
    let useSmallFont = false;
    if (lastHeading && (lastHeading.toLowerCase().includes('material') || lastHeading.toLowerCase().includes('gesamtkosten'))) {
      useSmallFont = true;
    }

    // Seitenumbruch prüfen
    const blockHeight = estimateBlockHeight(block, useSmallFont);
    if (y - blockHeight < minY) {
      // Hinweis auf vorheriger Seite
      currentPage.drawText('Fortsetzung auf nächster Seite', {
        x: width - marginRight - 180,
        y: minY + 10,
        size: 10,
        font: boldFont,
        color: rgb(0.5, 0.5, 0.5),
      });
      // Neue Seite beginnen
      currentPage = addNewPage();
      y = kostenplanY - 30;
      pageCount++;
    }

    // Block wie bisher zeichnen, aber auf currentPage und y
    if (block.type === 'heading') {
      let size = 18 - (block.level - 1) * 2;
      if (size < 10) size = 10;
      let headingFont = font;
      if (block.level === 2) {
        headingFont = boldFont;
        y -= size + 2;
      }
      currentPage.drawText(sanitizeText(block.text), {
        x: 40,
        y,
        size,
        font: headingFont,
        color: rgb(0, 0, 0),
      });
      y -= size + 6;
      lastHeading = block.text;
    } else if (block.type === 'paragraph') {
      let size = useSmallFont ? 10 : 12;
      const lines = wrapText(sanitizeText(block.text), font, size, maxWidth);
      lines.forEach(line => {
        if (line.trim() === 'Oberkiefer' || line.trim() === 'Unterkiefer') {
          currentPage.drawText(line, {
            x: 40,
            y,
            size: 9,
            font: boldFont, // Use bold font for Oberkiefer/Unterkiefer
            color: rgb(0, 0, 0)
          });
          y -= 9 + 2;
        } else {
          currentPage.drawText(sanitizeText(line), {
            x: 40,
            y,
            size,
            font,
            color: rgb(0, 0, 0),
          });
          y -= size + 1;
        }
      });
      y -= 2;
    } else if (block.type === 'table') {
      let fontSize = 12;
      if (useSmallFont || (block.table[0][0] === 'Nummer' && block.table[0][1] === 'Menge')) {
        fontSize = 10;
      } else if (block.table.length > 10 || block.table[0].length > 5) {
        fontSize = 9;
      }
      if (fontSize < minFontSize) fontSize = minFontSize;
      let colWidths;
      if (block.table[0].includes('Bezeichnung')) {
        if (block.table[0].length === 6) {
          // 6 Spalten: z.B. Nummer, Menge, Bezeichnung, Einzelpreis, Gesamtpreis, Bemerkung
          colWidths = [60, 40, 180, 70, 70, 80];
        } else {
          // Standard: 5 Spalten
          colWidths = [70, 50, 220, 80, 80];
        }
      } else if (block.table[0].length === 6) {
        colWidths = Array(6).fill(maxWidth / 6);
      } else if (block.table[0].length === 5) {
        colWidths = [70, 50, 220, 80, 80];
      } else {
        colWidths = Array(block.table[0].length).fill(maxWidth / block.table[0].length);
      }
      block.table.forEach((row, i) => {
        let rowHeight = fontSize + 2;
        const wrappedCells = row.map((cell, idx) => wrapText(sanitizeText(cell), font, fontSize, colWidths[idx] - 4));
        const maxLines = Math.max(...wrappedCells.map(lines => lines.length));
        rowHeight = maxLines * (fontSize + 1);
        const isSummeRow = row[0] && row[0].trim().startsWith('Summe');
        const isEndbetragRow = row[0] && row[0].trim().startsWith('Endbetrag');
        // Check for header row: Nummer, Menge, Bezeichnung
        const isHeaderUnderline = row.includes('Nummer') && row.includes('Menge') && row.includes('Bezeichnung');
        let x = 40;
        for (let j = 0; j < row.length; j++) {
          const lines = wrappedCells[j];
          for (let l = 0; l < lines.length; l++) {
            if ((lines[l].trim() === 'Oberkiefer' || lines[l].trim() === 'Unterkiefer')) {
              currentPage.drawText(lines[l], {
                x: x,
                y: y - l * (fontSize + 1),
                size: 9,
                font: boldFont, // Use bold font for Oberkiefer/Unterkiefer in tables
                color: rgb(0, 0, 0),
              });
            } else {
              currentPage.drawText(sanitizeText(lines[l]), {
                x: x,
                y: y - l * (fontSize + 1),
                size: fontSize,
                font: (isSummeRow || isEndbetragRow) ? boldFont : font,
                color: rgb(0, 0, 0)
              });
            }
          }
          x += colWidths[j];
        }
        if (isEndbetragRow) {
          const underlineWidth = colWidths.reduce((a, b) => a + b, 0);
          currentPage.drawLine({
            start: { x: 40, y: y - 2 },
            end: { x: 40 + underlineWidth, y: y - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
          });
        }
        // Draw underline for header row (Nummer, Menge, Bezeichnung)
        if (isHeaderUnderline) {
          const underlineWidth = colWidths.reduce((a, b) => a + b, 0);
          // Draw the underline just below the header row, right after drawing the header text
          currentPage.drawLine({
            start: { x: 40, y: y - 2 },
            end: { x: 40 + underlineWidth, y: y - 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
          });
        }
        y -= rowHeight + 1;
      });
      y -= 3;
    }
  });
  // === ENDE BODY ===

  // === FOOTER: Fußleiste mit 4 Spalten ===
  // (Diese Schleife entfällt, da der Footer oben schon gezeichnet wird)


  const pdfBytes = await pdfDoc.save()

  // Send PDF to webhook
  try {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    // Send as multipart/form-data to allow multiple fields
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', Buffer.from(pdfBytes), {
      filename: 'kostenplan.pdf',
      contentType: 'application/pdf'
    });
    form.append('name', 'Placeholder');
    form.append('email', useridentifier || '');
    form.append('date', dateStr);

    await axios.post(
      'https://hook.eu2.make.com/rv7t11k1wvhnmruq6txgd3iw1ol2or8l',
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );
    console.log('PDF sent to webhook successfully.');
  } catch (err) {
    console.error('Error sending PDF to webhook:', err.message);
  }


  // === PDF-Download/Antwort temporär deaktiviert ===
  // Die folgenden drei Zeilen wieder aktivieren, um den PDF-Download zu ermöglichen:
  // res.setHeader('Content-Type', 'application/pdf')
  // res.setHeader('Content-Disposition', 'attachment; filename="kostenplan.pdf"')
  // res.send(Buffer.from(pdfBytes))
  res.status(200).send('PDF-Download ist vorübergehend deaktiviert.');
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Hilfsfunktion zum Ersetzen nicht unterstützter Zeichen
function sanitizeText(text) {
  // Ersetze schmales geschütztes Leerzeichen (U+202F) durch normales Leerzeichen
  // und entferne Zeilenumbrüche, die pdf-lib nicht kodieren kann
  return text.replace(/[\u202F\n\r]/g, ' ');
}
