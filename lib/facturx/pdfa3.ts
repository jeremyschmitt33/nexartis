// lib/facturx/pdfa3.ts
// ---------------------------------------------------------------------------
// Packager PDF/A-3b "maison" (pdf-lib pur, compatible Vercel : aucun binaire
// Java/Ghostscript requis au runtime).
//
// Prend le PDF visuel existant (sortie jsPDF de Nexartis, polices deja
// embarquees) + le XML Factur-X (EN 16931) et produit un PDF/A-3b conforme :
//   - piece jointe factur-x.xml (AFRelationship "Alternative")
//   - OutputIntent avec profil ICC sRGB embarque (ISO 19005-3 clause 6.2)
//   - metadonnees XMP : pdfaid part=3/conformance=B + schema d'extension Factur-X
//   - /ID dans le trailer (clause 6.1.3), pas de flux xref (useObjectStreams=false)
//
// Resultat valide par veraPDF (flavour 3b, isCompliant=true) et par le
// validateur Factur-X Mustangproject. Remplace l'embarquement de node-zugferd,
// dont la sortie n'etait pas PDF/A-3 conforme.
// ---------------------------------------------------------------------------

import { PDFDocument, PDFName, PDFString, PDFHexString, AFRelationship } from 'pdf-lib'
import { createHash } from 'crypto'
import { SRGB_ICC_BASE64 } from './srgb-icc'

const ICC_BYTES = Buffer.from(SRGB_ICC_BASE64, 'base64')

function xmlEscape(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Construit le paquet XMP declarant la conformite PDF/A-3b + le profil Factur-X. */
function buildXmp(opts: { title: string; producer: string; creator: string; date: string }): string {
  const { title, producer, creator, date } = opts
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(title)}</rdf:li></rdf:Alt></dc:title>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>${xmlEscape(producer)}</pdf:Producer>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreatorTool>${xmlEscape(creator)}</xmp:CreatorTool>
   <xmp:CreateDate>${date}</xmp:CreateDate>
   <xmp:ModifyDate>${date}</xmp:ModifyDate>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>3</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
   <fx:DocumentType>INVOICE</fx:DocumentType>
   <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
   <fx:Version>1.0</fx:Version>
   <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
   <pdfaExtension:schemas>
    <rdf:Bag>
     <rdf:li rdf:parseType="Resource">
      <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
      <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
      <pdfaSchema:prefix>fx</pdfaSchema:prefix>
      <pdfaSchema:property>
       <rdf:Seq>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description></rdf:li>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>INVOICE</pdfaProperty:description></rdf:li>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>version of the Factur-X standard</pdfaProperty:description></rdf:li>
        <rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>conformance level of the Factur-X data</pdfaProperty:description></rdf:li>
       </rdf:Seq>
      </pdfaSchema:property>
     </rdf:li>
    </rdf:Bag>
   </pdfaExtension:schemas>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

export interface PackagePdfA3Options {
  /** Titre du document (doit refleter le numero de facture). */
  title: string
  /** Numero de facture (sert a deriver un /ID stable). */
  numero: string
}

/**
 * Transforme un PDF visuel + un XML Factur-X en PDF/A-3b conforme.
 * @param basePdfBytes  PDF visuel existant (polices embarquees attendues).
 * @param xmlString     XML Factur-X EN 16931.
 */
export async function packagePdfA3(
  basePdfBytes: Buffer | Uint8Array,
  xmlString: string,
  options: PackagePdfA3Options,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(basePdfBytes)
  const now = new Date()
  const producer = 'Nexartis Factur-X'
  const creator = 'Nexartis'

  pdf.setTitle(options.title)
  pdf.setProducer(producer)
  pdf.setCreator(creator)
  pdf.setCreationDate(now)
  pdf.setModificationDate(now)

  // Piece jointe XML (relation "Alternative", convention Factur-X / ZUGFeRD).
  await pdf.attach(new TextEncoder().encode(xmlString), 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'Factur-X (EN 16931 CII)',
    afRelationship: AFRelationship.Alternative,
    creationDate: now,
    modificationDate: now,
  })

  // OutputIntent + profil ICC sRGB embarque (N=3).
  const iccStream = pdf.context.flateStream(ICC_BYTES, { N: 3 })
  const iccRef = pdf.context.register(iccStream)
  const outputIntent = pdf.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: iccRef,
  })
  const outputIntentRef = pdf.context.register(outputIntent)
  pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([outputIntentRef]))

  // Metadonnees XMP (PDF/A-3b + Factur-X).
  const xmp = buildXmp({
    title: options.title,
    producer,
    creator,
    date: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  })
  const metaStream = pdf.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })
  const metaRef = pdf.context.register(metaStream)
  pdf.catalog.set(PDFName.of('Metadata'), metaRef)

  // /ID dans le trailer (ISO 19005-3 clause 6.1.3) : deux valeurs identiques.
  const idHex = createHash('md5').update(`${options.numero}|${now.toISOString()}`).digest('hex').toUpperCase()
  const idObj = PDFHexString.of(idHex)
  pdf.context.trailerInfo.ID = pdf.context.obj([idObj, idObj])

  // useObjectStreams:false -> table xref classique (les flux xref sont interdits en PDF/A).
  const bytes = await pdf.save({ useObjectStreams: false })
  return Buffer.from(bytes)
}
