import { google } from "googleapis";

export const OFFER_HEADERS = [
  "ID","Vertical","Type","Offer Name","Payout","Pay Term","States",
  "Hours","Cap","CC","Qualifiers","Status","Zip List"
];

export function getAuth() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  }
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

export function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function clean(v) {
  return v == null ? "" : String(v).trim();
}

export function rowToOffer(row, rowNumber) {
  return {
    _row: rowNumber,
    id: row[0] || "",
    vertical: row[1] || "",
    type: (row[2] || "wt").toLowerCase(),
    name: row[3] || "",
    payout: row[4] || "",
    payTerm: row[5] || "",
    states: row[6] || "",
    hours: row[7] || "",
    cap: row[8] || "",
    cc: row[9] || "",
    qualifiers: row[10] || "",
    status: row[11] || "Active",
    zipListLink: row[12] || ""
  };
}

export async function ensureOffersSheet() {
  const sheets = getSheets();
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const title = process.env.GOOGLE_OFFERS_SHEET_NAME || "Offers";
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheet = meta.data.sheets?.find(s => s.properties?.title === title);

  if (!sheet) {
    const result = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] }
    });
    sheet = result.data.replies?.[0]?.addSheet;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1:M1`,
      valueInputOption: "RAW",
      requestBody: { values: [OFFER_HEADERS] }
    });
  }

  return { sheets, spreadsheetId, title };
}

export async function getOffers() {
  const { sheets, spreadsheetId, title } = await ensureOffersSheet();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A2:M`
  });
  return (result.data.values || [])
    .filter(row => row.some(v => String(v || "").trim() !== ""))
    .map((row, i) => rowToOffer(row, i + 2));
}

export function requireAdmin(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token !== process.env.ADMIN_SESSION_SECRET) {
    const err = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
}

export function normalizeOffer(body = {}) {
  return {
    id: clean(body.id) || crypto.randomUUID(),
    vertical: clean(body.vertical),
    type: clean(body.type).toLowerCase() === "ib" ? "ib" : "wt",
    name: clean(body.name),
    payout: clean(body.payout),
    payTerm: clean(body.payTerm),
    states: clean(body.states),
    hours: clean(body.hours),
    cap: clean(body.cap),
    cc: clean(body.cc),
    qualifiers: clean(body.qualifiers),
    status: clean(body.status) || "Active",
    zipListLink: clean(body.zipListLink)
  };
}

function offerRow(o) {
  return [[
    o.id,o.vertical,o.type,o.name,o.payout,o.payTerm,o.states,o.hours,
    o.cap,o.cc,o.qualifiers,o.status,o.zipListLink
  ]];
}

export async function appendOffer(offer) {
  const { sheets, spreadsheetId, title } = await ensureOffersSheet();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${title}!A:M`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: offerRow(offer) }
  });
  return offer;
}

export async function updateOffer(offer) {
  const { sheets, spreadsheetId, title } = await ensureOffersSheet();
  const offers = await getOffers();
  const existing = offers.find(o => o.id === offer.id);
  if (!existing) {
    const err = new Error("Offer not found");
    err.status = 404;
    throw err;
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A${existing._row}:M${existing._row}`,
    valueInputOption: "RAW",
    requestBody: { values: offerRow(offer) }
  });
  return offer;
}

export async function deleteOffer(id) {
  const { sheets, spreadsheetId, title } = await ensureOffersSheet();
  const offers = await getOffers();
  const existing = offers.find(o => o.id === id);
  if (!existing) {
    const err = new Error("Offer not found");
    err.status = 404;
    throw err;
  }
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets.find(s => s.properties.title === title);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: "ROWS",
            startIndex: existing._row - 1,
            endIndex: existing._row
          }
        }
      }]
    }
  });
}

