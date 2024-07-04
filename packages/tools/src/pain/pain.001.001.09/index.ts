import Handlebars from 'handlebars'

export const PAIN_001_001_09_TEMPLATE = Handlebars.compile(`
<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09 pain.001.001.09.xsd">
	<CstmrCdtTrfInitn>
		<GrpHdr>
			<MsgId>{{id}}</MsgId>
			<CreDtTm>{{date}}</CreDtTm>
			<NbOfTxs>{{nbOfTxs}}</NbOfTxs>
			<InitgPty>
				<Nm>{{initiatorName}}</Nm>
			</InitgPty>
		</GrpHdr>
		<PmtInf>
			<PmtInfId>{{paymentId}}</PmtInfId>
			<PmtMtd>{{paymentMethod}}</PmtMtd>
			<ReqdExctnDt>
				<Dt>{{requestedExecutionDate}}</Dt>
			</ReqdExctnDt>
			<Dbtr>
				<Nm>{{debtorName}}</Nm>
			</Dbtr>
			<DbtrAcct>
				<Id>
					<IBAN>{{debtorIban}}</IBAN>
				</Id>
			</DbtrAcct>
			<DbtrAgt>
				<FinInstnId>
					<BICFI xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">{{debtorBic}}</BICFI>
				</FinInstnId>
			</DbtrAgt>
			<ChrgBr>{{chargeBearer}}</ChrgBr>
			{{#each transactions}} <CdtTrfTxInf>
			<PmtId>
				<EndToEndId>{{this.paymentId}}</EndToEndId>
			</PmtId>
			<Amt>
				<InstdAmt Ccy="{{this.paymentCurrency}}">{{this.paymentAmount}}</InstdAmt>
			</Amt>
			<CdtrAgt>
				<FinInstnId>
					<BICFI xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">{{this.creditorBic}}</BICFI>
				</FinInstnId>
			</CdtrAgt>
			<Cdtr>
				<Nm>{{this.creditorName}}</Nm>
			</Cdtr>
			<CdtrAcct>
				<Id>
					<IBAN>{{this.creditorIban}}</IBAN>
				</Id>
			</CdtrAcct>
      {{#if this.remittanceInformation}}
			<RmtInf>
				<Ustrd>{{tx.remittanceInformation}}</Ustrd>
			</RmtInf>
      {{/if}}
			<SplmtryData>
				<Envlp>
					<WC />
				</Envlp>
			</SplmtryData>
	</CdtTrfTxInf>
			{{#/each}} </PmtInf>
</CstmrCdtTrfInitn>
</Document>`)

interface Pain00100109Transaction {
  paymentId: string
  paymentCurrency: 'EUR' | 'USD'
  paymentAmount: string
  creditorName: string
  creditorIban: string
  creditorBic: string
  remittanceInformation?: string
}

export const renderPain00100109 = async ({
  id,
  date,
  initiatorName,
  paymentId,
  paymentMethod,
  requestedExecutionDate,
  debtorName,
  debtorIban,
  debtorBic,
  chargeBearer,
  transactions
}: {
  id: string
  date: string
  initiatorName: string
  paymentId: string
  paymentMethod: 'TRF' | 'CHK'
  requestedExecutionDate: string
  debtorName: string
  debtorIban: string
  debtorBic: string
  chargeBearer: 'CRED' | 'DEBT' | 'SHAR'
  transactions: Pain00100109Transaction[]
}) => {
  const nbOfTxs = transactions.length
  return PAIN_001_001_09_TEMPLATE({
    id,
    date,
    initiatorName,
    paymentId,
    paymentMethod,
    requestedExecutionDate,
    debtorName,
    debtorIban,
    debtorBic,
    chargeBearer,
    transactions,
    nbOfTxs
  })
}
