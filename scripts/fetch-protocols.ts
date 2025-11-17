import { env } from 'node:process';
import { parse } from 'node:path';
import { existsSync, mkdirSync, readdirSync, readFile, writeFile } from 'node:fs';
import { createInterface } from 'node:readline';

import { drive_v3, google } from 'googleapis';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly', 'https://www.googleapis.com/auth/drive.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = new URL('./token.json', import.meta.url).pathname;
const CREDENTIALS_PATH = new URL('./credentials.json', import.meta.url).pathname;
const PROTOCOLS_PATH = new URL('../src/protocols.json', import.meta.url).pathname;
console.log(CREDENTIALS_PATH);

// Load client secrets from a local file.
readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  const folder = env.GOOGLE_DRIVE_FOLDER_ID;
  const credentials = JSON.parse(`${content}`);
  credentials.web.client_id = env.GOOGLE_DRIVE_CLIENT_ID;
  credentials.web.project_id = env.GOOGLE_DRIVE_PROJECT_ID;
  credentials.web.client_secret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  authorize(credentials, auth => {
    const drive = google.drive({ version: 'v3', auth });
    listFiles(folder, drive);
    generateIndex();
  });
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    const tokens = JSON.parse(`${token}`);
    tokens.access_token = env.GOOGLE_DRIVE_ACCESS_TOKEN;
    tokens.refresh_token = env.GOOGLE_DRIVE_REFRESH_TOKEN;
    tokens.expiry_date = env.GOOGLE_DRIVE_REFRESH_EXPIRY_DATE;
    oAuth2Client.setCredentials(tokens);
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      callback(oAuth2Client);
      console.info('Store new token in env\n', token);
    });
  });
}

function generateIndex() {
  const parent = new URL(`../src/pages/protokolle`, import.meta.url).pathname;
  const files = readdirSync(parent, { recursive: true, encoding: 'utf-8' });
  const data = files.reduce((all, name) => ({ ...all, [name]: `/pages/protokolle/${name}` }), {});
  writeFile(PROTOCOLS_PATH, JSON.stringify(data), err => {
    if (err) return console.error(err);
  });
}

function getFileContent({ id, name }: drive_v3.Schema$File, drive: drive_v3.Drive, dir = '') {
  const path = encodeURIComponent(name);
  const parent = new URL(`../src/pages/protokolle${dir}`, import.meta.url).pathname;
  const target = new URL(`${parent}/${path}`, import.meta.url).pathname;

  drive.files.get({ fileId: id, alt: 'media' }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    if (res.data) {
      if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
      writeFile(target, res.data.toString() as string, err => {
        if (err) console.error(err);
      });
    }
  });
}

/**
 * Lists the files of a given folder
 * @param folder
 * @param {google.auth.OAuth2} drive An authorized OAuth2 client.
 */
function listFiles(folder: string, drive: drive_v3.Drive, dir = '') {
  drive.files.list(
    {
      fields: 'files(id, name, kind, mimeType)',
      q: `'${folder}' in parents`,
    },
    (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);
      const files = res.data.files;
      if (files.length) {
        files.map(async file => {
          if (file.name === '.gitignore') return;
          if (file.name === 'PW') return;

          if (file.mimeType === 'application/vnd.google-apps.folder') {
            console.log(`> ${dir}/${file.name} (${file.id})`);
            listFiles(file.id as string, drive, `${dir}/${file.name}`);
          } else {
            console.log(`- ${dir}/${file.name} (${file.id})`);
            getFileContent(file, drive, dir);
            // const target = resolve(__dirname, '../src/pages/protokolle', name);
            // const content = await fetch(webContentLink, { redirect: 'follow' });
            // writeFile(target, await content.text(), (err) => {
            //   if (err) return console.error(err);
            // });
          }
        });
      } else {
        console.log('No files found.');
      }
    },
  );
}
