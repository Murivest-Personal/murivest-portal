import {PDFDocument, rgb, StandardFonts} from 'pdf-lib'
import type {KYCBuyerForm} from '@/lib/sanity/types'

const MURIVEST_RED = rgb(0.72, 0.11, 0.16)
const MURIVEST_DARK = rgb(0.13, 0.16, 0.21)
const MURIVEST_GRAY = rgb(0.45, 0.48, 0.53)
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94)
const WHITE = rgb(1, 1, 1)

function fmt(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function checkBox(checked: unknown): string {
  return checked === true ? '[X]' : '[ ]'
}

export async function generateKycFormPdf(params: {
  propertyTitle: string
  propertyLocation?: string | null
  propertyReference?: string | null
  form: KYCBuyerForm | null
  generatedAt?: string
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const {width, height} = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = 9
  const leading = 12
  const marginX = 54
  let y = height - 54

  const f = params.form ?? {}
  const individual = f.individual ?? {}
  const company = f.company ?? {}
  const transaction = f.transaction ?? {}
  const sourceOfFunds = f.sourceOfFunds ?? {}
  const declarations = f.declarations ?? {}
  const documents = f.documents ?? {}

  // ---------- Header ----------
  page.drawText('MURIVEST PRIVATE CAPITAL PORTAL', {
    x: marginX, y, size: 16, font: fontBold, color: MURIVEST_RED,
  })
  y -= 22
  page.drawText('KYC Buyer Information Form', {
    x: marginX, y, size: 13, font: fontBold, color: MURIVEST_DARK,
  })
  y -= 16
  page.drawText(
    `Property: ${params.propertyTitle}${params.propertyLocation ? ` — ${params.propertyLocation}` : ''}`,
    {x: marginX, y, size: fontSize, font, color: MURIVEST_DARK},
  )
  y -= 14
  if (params.propertyReference) {
    page.drawText(`Reference: ${params.propertyReference}`, {x: marginX, y, size: fontSize, font, color: MURIVEST_DARK})
    y -= 14
  }
  page.drawText(`Generated: ${params.generatedAt ?? new Date().toISOString().slice(0, 10)}`, {
    x: marginX, y, size: fontSize, font, color: MURIVEST_GRAY,
  })
  y -= 10
  page.drawRectangle({
    x: marginX, y, width: width - marginX * 2, height: 1.5, color: MURIVEST_RED,
  })
  y -= 22

  // ---------- Section helper ----------
  const section = (title: string) => {
    page.drawRectangle({x: marginX, y, width: width - marginX * 2, height: 14, color: MURIVEST_RED})
    page.drawText(title, {x: marginX + 6, y: y + 4, size: 10, font: fontBold, color: WHITE})
    y -= 22
  }

  const fieldRow = (label: string, value: string) => {
    page.drawText(label, {x: marginX, y, size: fontSize, font: fontBold, color: MURIVEST_DARK})
    page.drawText(value, {x: marginX + 120, y, size: fontSize, font, color: MURIVEST_DARK, maxWidth: width - marginX * 2 - 130})
    const lines = Math.max(1, Math.ceil(value.length / 85))
    y -= Math.max(leading, lines * leading) + 4
  }

  const checkRow = (label: string, checked: unknown) => {
    page.drawText(checkBox(checked), {x: marginX, y, size: fontSize, font: fontBold, color: MURIVEST_DARK})
    page.drawText(label, {x: marginX + 18, y, size: fontSize, font, color: MURIVEST_DARK})
    y -= leading + 4
  }

  // ---------- Section A: Buyer Information ----------
  section('SECTION A — BUYER INFORMATION')
  page.drawText('Type of Buyer:', {x: marginX, y, size: fontSize, font: fontBold, color: MURIVEST_DARK})
  const buyerLabel = f.buyerType ? String(f.buyerType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''
  page.drawText(buyerLabel, {x: marginX + 120, y, size: fontSize, font, color: MURIVEST_DARK})
  y -= leading + 8

  if (f.buyerType === 'individual') {
    fieldRow('Full Name:', fmt(individual.fullName))
    fieldRow('ID / Passport Number:', fmt(individual.idPassportNumber))
    fieldRow('Nationality:', fmt(individual.nationality))
    fieldRow('Date of Birth:', fmt(individual.dateOfBirth))
    fieldRow('KRA PIN:', fmt(individual.kraPin))
    fieldRow('Phone Number:', fmt(individual.phoneNumber))
    fieldRow('Email Address:', fmt(individual.emailAddress))
    fieldRow('Current Residential Address:', fmt(individual.currentResidentialAddress))
    fieldRow('Postal Address (if different):', fmt(individual.postalAddress))
  } else if (f.buyerType === 'company') {
    fieldRow('Company Name:', fmt(company.companyName))
    fieldRow('Registration Number:', fmt(company.registrationNumber))
    fieldRow('Date of Incorporation:', fmt(company.dateOfIncorporation))
    fieldRow('Country of Incorporation:', fmt(company.countryOfIncorporation))
    fieldRow('Registered Office Address:', fmt(company.registeredOfficeAddress))
    fieldRow('KRA PIN (Company):', fmt(company.companyKraPin))
    fieldRow('Contact Person:', fmt(company.contactPerson))
    fieldRow('Designation:', fmt(company.designation))
    fieldRow('Contact Email:', fmt(company.contactEmail))
    fieldRow('Contact Phone:', fmt(company.contactPhone))
    if (company.directors?.length) {
      page.drawText('Names of Directors:', {x: marginX, y, size: fontSize, font: fontBold, color: MURIVEST_DARK})
      y -= leading
      for (const d of company.directors) {
        page.drawText(`• ${d}`, {x: marginX + 12, y, size: fontSize, font, color: MURIVEST_DARK})
        y -= leading
      }
      y -= 4
    }
  } else {
    fieldRow('Buyer Type (Other):', f.buyerType ?? '')
  }
  y -= 6

  // ---------- Section B: Transaction Details ----------
  section('SECTION B — TRANSACTION DETAILS')
  fieldRow('Property Description / Location:', fmt(transaction.propertyDescription))
  fieldRow('Type of Asset:', fmt(transaction.assetType))
  fieldRow('Estimated Purchase Price (KES):', fmt(transaction.estimatedPurchasePrice))
  fieldRow('Mode of Financing:', fmt(transaction.modeOfFinancing))
  if (transaction.financingOther) fieldRow('Other Financing:', fmt(transaction.financingOther))
  fieldRow('Intended Use of Property:', fmt(transaction.intendedUse))
  if (transaction.intendedUseOther) fieldRow('Other Intended Use:', fmt(transaction.intendedUseOther))
  y -= 6

  // ---------- Section C: Source of Funds ----------
  section('SECTION C — SOURCE OF FUNDS DECLARATION')
  fieldRow('Origin of Funds:', fmt(sourceOfFunds.sourceOfFundsDetail))
  checkRow('Bank Statements Attached:', sourceOfFunds.bankStatementsAttached)
  checkRow('Loan Approval Letter Attached:', sourceOfFunds.loanApprovalLetterAttached)
  checkRow('Sale Agreement from Prior Asset Attached:', sourceOfFunds.saleAgreementAttached)
  checkRow('Other Supporting Documents Attached:', sourceOfFunds.otherSupportingDocumentsAttached)
  y -= 6

  // ---------- Section D: Declarations & Consents ----------
  section('SECTION D — DECLARATIONS & CONSENTS')
  fieldRow('Politically Exposed Person (PEP):', fmt(declarations.isPep))
  if (declarations.pepDetails) fieldRow('PEP Details:', fmt(declarations.pepDetails))
  if (declarations.beneficialOwners?.length) {
    page.drawText('Beneficial Owners (>10% ownership):', {x: marginX, y, size: fontSize, font: fontBold, color: MURIVEST_DARK})
    y -= leading
    for (const bo of declarations.beneficialOwners) {
      page.drawText(`• ${fmt(bo.name)} — ${fmt(bo.idPassport)}`, {x: marginX + 12, y, size: fontSize, font, color: MURIVEST_DARK})
      y -= leading
    }
    y -= 4
  }
  fieldRow('Consent & Declaration:', fmt(declarations.consent))
  fieldRow('Signed By:', fmt(declarations.signedBy))
  fieldRow('Date:', fmt(declarations.signedDate))
  fieldRow('Capacity (if company):', fmt(declarations.capacity))
  y -= 6

  // ---------- Section E: Documents ----------
  section('SECTION E — DOCUMENTS TO ATTACH')
  const docFields: [string, unknown][] = [
    ['ID / Passport copy', documents.idPassportCopy],
    ['Certificate of Incorporation', documents.certificateOfIncorporation],
    ['KRA PIN', documents.kraPinDoc],
    ['CR12', documents.cr12],
    ['Proof of address', documents.proofOfAddress],
    ['Company KRA PIN', documents.companyKraPinDoc],
    ['2x passport photos', documents.passportPhotos],
    ['Board resolution to purchase', documents.boardResolution],
    ['Source of funds docs', documents.sourceOfFundsDocs],
    ["Directors' IDs + PINs", documents.directorsIdsPins],
    ['Beneficial Ownership form', documents.beneficialOwnershipForm],
  ]
  let col = 0
  const colX = [marginX, marginX + 220]
  for (const [label, checked] of docFields) {
    const cx = colX[col]
    page.drawText(checkBox(checked), {x: cx, y, size: fontSize, font: fontBold, color: MURIVEST_DARK})
    page.drawText(label, {x: cx + 18, y, size: fontSize, font, color: MURIVEST_DARK})
    col++
    if (col === 2) { col = 0; y -= leading + 4 }
  }
  if (col === 1) y -= leading + 4

  // ---------- Footer ----------
  y -= 18
  page.drawRectangle({x: marginX, y, width: width - marginX * 2, height: 1.5, color: LIGHT_GRAY})
  y -= 14
  page.drawText('Murivest Private Capital Portal — KYC Buyer Information Form', {
    x: marginX, y, size: 7.5, font, color: MURIVEST_GRAY,
  })
  page.drawText(`Generated ${params.generatedAt ?? new Date().toISOString().slice(0, 10)}`, {
    x: width - marginX - 150, y, size: 7.5, font, color: MURIVEST_GRAY,
  })

  return pdfDoc.save()
}
