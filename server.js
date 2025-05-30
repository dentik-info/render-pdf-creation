const express = require('express')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const fs = require('fs')
const path = require('path')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

app.use('/public', express.static(path.join(__dirname, 'public')))

function parseMarkdownToData(md) {
  const lines = md.split('\n')
  const data = {}
  lines.forEach(line => {
    const [key, ...rest] = line.split(':')
    if (key && rest.length > 0) {
      data[key.trim()] = rest.join(':').trim()
    }
  })
  return {
    kundeName: data['Kunde'] || '',
    kundeOrt: data['Ort'] || '',
    patientName: data['Patient'] || '',
    belegNr: data['Beleg-Nr'] || '',
    belegDatum: data['Beleg-Datum'] || '',
    herstellungsort: data['Herstellungsort'] || '',
    arbeitsart: data['Arbeitsart'] || '',
    zahnfarbe: data['Zahnfarbe'] || ''
  }
}

app.post('/generate-pdf', async (req, res) => {
  const markdown = req.body.markdown
  const data = parseMarkdownToData(markdown)

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const { width, height } = page.getSize()

  const logoPath = path.join(__dirname, 'public', 'logo.png')
  const logoBytes = fs.readFileSync(logoPath)
  const logoImage = await pdfDoc.embedPng(logoBytes)

  page.drawImage(logoImage, {
    x: 50,
    y: height - 90,
    width: 50,
    height: 50,
  })

  page.drawText('DENTAL', {
    x: 110,
    y: height - 60,
    size: 20,
    font,
    color: rgb(0, 0, 0),
  })

  page.drawText(data.kundeName, { x: 50, y: height - 130, size: 12, font })
  page.drawText(data.kundeOrt, { x: 50, y: height - 145, size: 12, font })

  page.drawText('Patienten-Name', { x: 400, y: height - 90, size: 10, font })
  page.drawText(data.patientName, { x: 400, y: height - 105, size: 12, font })

  page.drawText('Beleg-Nr.', { x: 400, y: height - 130, size: 10, font })
  page.drawText(data.belegNr, { x: 400, y: height - 145, size: 12, font })

  page.drawText('Beleg-Datum', { x: 400, y: height - 170, size: 10, font })
  page.drawText(data.belegDatum, { x: 400, y: height - 185, size: 12, font })

  page.drawText('Herstellungsort', { x: 400, y: height - 210, size: 10, font })
  page.drawText(data.herstellungsort, { x: 400, y: height - 225, size: 12, font })

  page.drawText('Arbeitsart', { x: 50, y: height - 180, size: 10, font })
  page.drawText(data.arbeitsart, { x: 50, y: height - 195, size: 12, font })

  page.drawText('Zahnfarbe, -form', { x: 200, y: height - 180, size: 10, font })
  page.drawText(data.zahnfarbe, { x: 200, y: height - 195, size: 12, font })

  const pdfBytes = await pdfDoc.save()
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="kostenplan.pdf"')
  res.send(Buffer.from(pdfBytes))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
