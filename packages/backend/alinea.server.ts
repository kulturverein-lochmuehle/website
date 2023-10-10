import { PasswordLess } from '@alinea/auth.passwordless';
import { Backend, JsonLoader } from '@alinea/backend';
import { GithubData } from '@alinea/backend.github';
import { IndexedDBDrafts } from '@alinea/backend.indexeddb/IndexedDBDrafts';
import { JWTPreviews } from '@alinea/backend/util/JWTPreviews';
import { backend } from '@alinea/core';
import { createTransport } from 'nodemailer';
import { parseBoolean } from './lib/utils';

export const configureBackend = backend.configure<PasswordLess>(({ auth, config, createStore }) => {
  // The authentication service needs to link to your admin panel
  // to create magic links and email them
  const dashboardUrl = 'https://alinea.sh/admin.html';

  // Configure the server side of the passwordless service
  const passwordless = auth.configure({
    dashboardUrl,
    // This is the subject of the magic link mails
    subject: 'Login',
    // Send the mails from this address
    from: `"KVLM" <admin@kulturverein-lochmuehle.de>`,
    // We pass a nodemailer transporter so the service can send mails
    transporter: createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: parseBoolean(process.env.SMTP_SECURE),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }),
    // A secret is needed to sign the magic link tokens
    jwtSecret: process.env.JWT_SECRET!,
    // Email adresses pass through here while logging in,
    // return true when a user is valid and is allowed to log in
    async isUser(email: string) {
      return email.endsWith('@enke.dev');
    }
  });

  // Create a drafts instance that will save and retrieve drafts from Redis
  const drafts = new IndexedDBDrafts();

  // Publish content changes to Github
  const data = new GithubData({
    config,
    loader: JsonLoader,
    // Pass a token which is authorized to read and write to the repository
    githubAuthToken: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    author: {
      name: process.env.GITHUB_AUTHOR_NAME,
      email: process.env.GITHUB_AUTHOR_EMAIL
    }
  });

  return new Backend({
    dashboardUrl,
    auth: passwordless,
    config,
    createStore,
    drafts,
    target: data,
    media: data,
    previews: new JWTPreviews(process.env.JWT_SECRET)
  });
});
