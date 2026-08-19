import { IncomingForm } from 'formidable';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new IncomingForm({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Form parsing failed' });
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
        ],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      const drive = google.drive({ version: 'v3', auth });

      const companyName = fields.company_name?.[0] || '';
      const companyEmail = fields.company_email?.[0] || '';
      const offerName = fields.offer_name?.[0] || '';

      // Helper to upload file buffer to Google Drive
      async function uploadFileToDrive(fileObj) {
        if (!fileObj) return '';
        const fileBuffer = require('fs').readFileSync(fileObj.filepath);
        const stream = new Readable();
        stream.push(fileBuffer);
        stream.push(null);

        const response = await drive.files.create({
          requestBody: {
            name: fileObj.originalFilename,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
          },
          media: {
            mimeType: fileObj.mimetype,
            body: stream,
          },
        });
        return `https://drive.google.com/file/d/${response.data.id}/view`;
      }

      const dataSampleUrl = await uploadFileToDrive(files.data_sample?.[0]);
      
      // Handle multiple call recordings
      const recordings = Array.isArray(files.call_recordings) ? files.call_recordings : [files.call_recordings];
      const recordingUrls = [];
      for (const rec of recordings) {
        if (rec) {
          const url = await uploadFileToDrive(rec);
          recordingUrls.push(url);
        }
      }

      const scriptUrl = files.script_file?.[0] ? await uploadFileToDrive(files.script_file[0]) : 'N/A';

      // Append row to Google Sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Sheet1!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toISOString(),
            companyName,
            companyEmail,
            offerName,
            dataSampleUrl,
            recordingUrls.join(', '),
            scriptUrl
          ]],
        },
      });

      return res.status(200).json({ success: true, message: 'Application submitted successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  });
}
