import { makeFingerprint } from './amex-parser.js';

export interface ParsedOfxRow {
  transactionDate: string;
  amount: string;
  description: string;
  originalDescription: string;
  bankTransactionId: string | null;
  fingerprint: string;
  rowIndex: number;
}

export interface OfxParseResult {
  rows: ParsedOfxRow[];
  errors: { rowIndex: number; message: string }[];
}

export function parseOfx(raw: string): OfxParseResult {
  // Strip SGML header block (everything before the first <OFX> tag)
  const ofxStart = raw.search(/<OFX[\s>]/i);
  const body = ofxStart >= 0 ? raw.slice(ofxStart) : raw;

  const txnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const rows: ParsedOfxRow[] = [];
  const errors: OfxParseResult['errors'] = [];
  let rowIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = txnRegex.exec(body)) !== null) {
    try {
      const block = match[1]!;

      const dtPosted = field(block, 'DTPOSTED');
      if (!dtPosted) throw new Error('Missing DTPOSTED');
      const transactionDate = parseOfxDate(dtPosted);

      const amtRaw = field(block, 'TRNAMT');
      if (!amtRaw) throw new Error('Missing TRNAMT');
      // OFX sign: negative = debit/expense. Our convention: positive = expense.
      const amount = negateOfxAmount(amtRaw);

      const fitid = field(block, 'FITID') ?? null;
      const name = (field(block, 'NAME') ?? '').trim();
      const memo = (field(block, 'MEMO') ?? '').trim();

      let description = name;
      if (memo && memo.toLowerCase() !== name.toLowerCase()) {
        description = name ? `${name} — ${memo}` : memo;
      }
      if (!description) throw new Error('Missing NAME and MEMO');

      rows.push({
        transactionDate,
        amount,
        description,
        originalDescription: description,
        bankTransactionId: fitid,
        fingerprint: makeFingerprint({ transactionDate, amount, originalDescription: description, bankTransactionId: fitid }),
        rowIndex,
      });
    } catch (err) {
      errors.push({ rowIndex, message: err instanceof Error ? err.message : String(err) });
    }
    rowIndex++;
  }

  if (rows.length === 0 && errors.length === 0) {
    throw new Error('No transactions found — is this a valid OFX/QFX file?');
  }

  return { rows, errors };
}

// Extracts the value of a simple OFX field: <TAG>value (no closing tag in SGML;
// has closing tag in XML — the regex stops at the first < either way).
function field(block: string, tag: string): string | undefined {
  const m = block.match(new RegExp(`<${tag}>[\\t ]*(.*?)\\s*(?:<|$)`, 'i'));
  return m ? m[1]!.trim() : undefined;
}

// OFX dates: YYYYMMDDHHMMSS[.mmm][+offset:label] — we only need the date part.
function parseOfxDate(raw: string): string {
  const m = raw.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) throw new Error(`Invalid OFX date: ${raw}`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Negate OFX amount to match our convention (positive = expense).
function negateOfxAmount(raw: string): string {
  const n = parseFloat(raw.trim().replace(/,/g, ''));
  if (isNaN(n)) throw new Error(`Invalid OFX amount: ${raw}`);
  return (-n).toFixed(2);
}

export function isOfxContent(buf: Buffer): boolean {
  const head = buf.slice(0, 1024).toString('utf8');
  return /OFXHEADER:|<OFX[\s>]|<\?OFX/i.test(head);
}
