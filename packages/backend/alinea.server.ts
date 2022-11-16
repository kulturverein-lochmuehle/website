import { PasswordLess } from '@alinea/auth.passwordless';
import { Backend, JsonLoader } from '@alinea/backend';
import { GithubData } from '@alinea/backend.github';
import { IndexedDBDrafts } from '@alinea/backend.indexeddb/IndexedDBDrafts';
import { JWTPreviews } from '@alinea/backend/util/JWTPreviews';
import { backend } from '@alinea/core';
import { createTransport } from 'nodemailer';

export const configureBackend = backend.configure<PasswordLess>(
  ({ auth, config, createStore }) => {
    // The authentication service needs to link to your admin panel
    // to create magic links and email them
    const dashboardUrl = 'https://alinea.sh/admin.html';

    // Configure the server side of the passwordless service
    const passwordless = auth.configure({
      dashboardUrl,
      // This is the subject of the magic link mails
      subject: 'Login',
      // Send the mails from this address
      from: `"Alinea" <no-reply@alinea.sh>`,
      // We pass a nodemailer transporter so the service can send mails
      transporter: createTransport(),
      // Pass all the required transport configuration options
      // See: http://nodemailer.com/smtp/

      // { ...smtpConfig }

      // A secret is needed to sign the magic link tokens
      jwtSecret: process.env.JWT_SECRET!,
      // Email adresses pass through here while logging in,
      // return true when a user is valid and is allowed to log in
      async isUser(email: string) {
        return email.endsWith('@enke.dev');
      },
    });

    // Create a drafts instance that will save and retrieve drafts from Redis
    const drafts = new IndexedDBDrafts();

    // Publish content changes to Github
    const data = new GithubData({
      config,
      loader: JsonLoader,
      // Pass a token which is authorized to read and write to the repository
      githubAuthToken: process.env.GITHUB_TOKEN!,
      owner: 'kulturverein-lochmuehle',
      repo: 'website',
      branch: 'next',
      author: {
        name: 'David Enke',
        email: 'david@enke.dev',
      },
    });

    return new Backend({
      dashboardUrl,
      auth: passwordless,
      config,
      createStore,
      drafts,
      target: data,
      media: data,
      previews: new JWTPreviews(process.env.JWT_SECRET!),
    });
  }
);
