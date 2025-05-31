const express = require('express')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/public', express.static(path.join(__dirname, 'public')))

app.post('/generate-pdf', async (req, res) => {
  const markdown = req.body.markdown

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
  const logoHeight = 80;
  const logoX = (width - logoWidth) / 2;
  const logoY = height - 80;
  page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  // Firmenname mittig unter dem Logo, mit zwei Leerzeilen Abstand
  page.drawText('Test-KV für Beispielfälle', {
    x: width / 2 - 50,
    y: logoY - 40, // Abstand für zwei Leerzeilen
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  // Adresszeile links
  page.drawText('Testkunde', {
    x: 40,
    y: logoY - 60,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('49134 Wallenhorst', {
    x: 40,
    y: logoY - 75,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Rechte Seite: Patientendaten etc. (tiefer positioniert)
  const patientBlockY = logoY - 60;
  page.drawText('Patienten-Name', {
    x: 350,
    y: patientBlockY,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Mustermann', {
    x: 470,
    y: patientBlockY,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Beleg-Nr.:', {
    x: 350,
    y: patientBlockY - 18,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('2025.05.00006', {
    x: 470,
    y: patientBlockY - 18,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Beleg-Datum:', {
    x: 350,
    y: patientBlockY - 33,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('27.05.2025', {
    x: 470,
    y: patientBlockY - 33,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Kunden-Nr.:', {
    x: 350,
    y: patientBlockY - 48,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('50000', {
    x: 470,
    y: patientBlockY - 48,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Kostenträger:', {
    x: 350,
    y: patientBlockY - 63,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('GKV', {
    x: 470,
    y: patientBlockY - 63,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Arbeitsart und Zahnfarbe links unter Adresszeile
  page.drawText('Arbeitsart', {
    x: 40,
    y: logoY - 110,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('PLATZHALTER', {
    x: 110,
    y: logoY - 110,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText('Zahnfarbe, -form', {
    x: 40,
    y: logoY - 125,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  // Überschrift Kostenplan mittig, eigene Zeile, Leerzeile danach
  const kostenplanY = logoY - 150;
  page.drawText('Kostenplan', {
    x: width / 2 - 50,
    y: kostenplanY,
    size: 18,
    font,
    color: rgb(0, 0, 0),
  });

  // Body: Markdown-Text unter Kostenplan mit Leerzeile
  const bodyY = kostenplanY - 30;
  page.drawText(markdown, {
    x: 40,
    y: bodyY,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  })

  const pdfBytes = await pdfDoc.save()
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="kostenplan.pdf"')
  res.send(Buffer.from(pdfBytes))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
