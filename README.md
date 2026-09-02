# Mindapp

A thoughtfully designed organizer.

Intentionally text only so you can reference other media via links.

Best used with the Mindapp extension.

https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep

## How to run locally

Make sure you have:
- Git installed: https://git-scm.com/install/
- Bun installed: https://bun.sh/

In your computer's terminal:

1. `git clone https://github.com/mileung/mindapp.git` *Downloads Mindapp codebase to your computer*
2. `cd mindapp` *Changes your terminal's working directory to mindapp*
3. `bun install` *Installs project dependencies in package.json*
4. `bun run dev` *Runs Mindapp locally in dev mode, creates global-test.db file*
5. Exit terminal process (Control C)
6. `bun run db:push` *Sets the local database schema for global-test.db*
7. Accept the prompt to run the SQL commands
8. `bun run dev`

At this point, you should have a fully functional Mindapp instance that only your computer has access to. You can try tinkering with the code and make changes locally. If you want better performance, you can run `bun run build`, then `bun run preview` to run the production build locally.


## Architecture

Mindapp is a SvelteKit app that uses a libSQL database.

SvelteKit: https://svelte.dev/docs/kit/introduction
libSQL: https://docs.turso.tech/libsql

It is hosted on Netlify (for the SvelteKit client/server logic) and Turso for the database
Netlify: https://www.netlify.com/pricing/
Turso: https://turso.tech/pricing

The codebase uses a single generic table called "parts" to store every row.
The parts table schema is:
```
code INTEGER NOT NULL
txt TEXT
p1 INTEGER
p2 INTEGER
p3 INTEGER
p4 INTEGER
p5 INTEGER
p6 INTEGER
p7 INTEGER
p8 INTEGER
```

The `code` column corresponds to several different part codes whose names describes how the p1-p8 columns are used. For example, part code `0` is `postImb_parentMb_rootMb_childCount`. That means 
`postImb`: p1 = in_ms, p2 = ms, p3 = by_ms
`parentMb`: p4/p5 = parent post ms/by_ms
`rootMb`: p6/p7 = root post ms/by_ms
`childCount`: p8 = how many direct replies the post has

`in_ms`, `ms`, and `by_ms` are variable names to identify where something is, when it happened, and by who. They are all Unix timestamp in milliseconds. The timestamp when you create an account is your account id. The timestamp when you create a space is that space's id. Etc.

For the full list of part codes and how the rows are indexed, see:
`partCodes.ts`: https://github.com/mileung/mindapp/blob/main/src/lib/types/parts/partCodes.ts
`partsTable.ts`: https://github.com/mileung/mindapp/blob/main/src/lib/types/parts/partsTable.ts
`local-db.ts`: https://github.com/mileung/mindapp/blob/main/src/lib/local-db.ts

The Mindapp client runs a SQLite database with the same schema as the cloud db for saving posts offline.

## How to run on the internet

### Deploy SvelteKit app

1. Fork this repository
2. Clone your fork and get it running locally with the steps above
3. Log into https://netlify.com
4. *Add new project*
5. Import your Mindapp Git repository 
6. Set build command to `bun run build`
7. Set publish directory command to `build`
8. *Deploy* Mindapp

At this point, Netlify should have deployed your own instance of Mindapp to some public url like ***.netlify.app. If you visit the Global post feed, it will show an error because there is no database connected to the app.

### Set up database

1. Go to **Project configuration**, then **Environment variables**
2. Leave this page open and open your local Mindapp fork repository in a text editor
3. Copy and paste the `.env.example` file and rename it to `.env`
4. Back in your browser, open a new tab
5. Log into https://turso.tech
6. *Create Database*
7. Copy the database url
8. Go back to your Netlify tab
9. *Add a variable* (single)
10. Set the key to `DATABASE_URL`
11. Set the value to your copied database url from Turso
12. *Create variable*
13. Back in your text editor, paste your database url in `.env` like `DATABASE_URL="libsql://..."`
14. Go back to your Turso tab
15. *Create Token* (Expires Never, Authorized for Read & Write)
16. Copy token
17. Go back to your Netlify tab
18. *Add a variable* (single)
19. Set the key to `DATABASE_AUTH_TOKEN`
20. Check Contains secret values
21. Set the *Production* value to your copied database token from Turso
22. *Create variable*
23. Go to **Deploys**, then **Trigger deploy**, then **Deploy project**
24. Back in your text editor, paste your database token in `.env` like `DATABASE_AUTH_TOKEN="..."`
25. Save your changes to `.env`
26. In your terminal, run `bun run db:push:cloud`
27. Arrow down to `Yes, I want to execute all statements`
28. Press Enter

At this point, the database in Turso's cloud should have the correct schema so it can be used by the SvelteKit app. If the Global post feed say "Nothing found", that means it successfully read the database! Now in order to create an account, we have to set up an email API.

### Set up email API

1. *Leave this page open, then in a new tab*
2. Back in your browser, open a new tab
3. Log into https://resend.com
4. Go to *API keys*, then *Create API key*
5. Name it, *Add*, then copy your API key
6. Go back to your Netlify tab under **Project configuration**, then **Environment variables**
7. *Add a variable* (single)
8.  Set the key to `RESEND_API_KEY`
9.  Check Contains secret values
10. Set the *Production* value to your copied email API token from Resend
11. *Create variable*
12. Go to **Deploys**, then **Trigger deploy**, then **Deploy project**

At this point, with the SvelteKit app redeployed with the database and email API environment variables, you should be able to create an account on your Mindapp instance.

### Initialize Global space

1. Create an account on your Mindapp instance
2. Visit https://<your Mindapp instance url host>/invite/0_init
3. Accept the invite (this invite can only be used once per Mindapp instance)

At this point, your account should be an admin of the global space meaning you can create invites, set roles for members, and kick members of the space. Any account not in the Global space will not be able to make posts in any space.

### Set Mindapp instance owner

1. Go to your Personal space on your Mindapp instance
2. Copy your account ms in the url path (e.g. if your personal space is at `/12345678__`, your account ms is `12345678`)
3. Go back to your Netlify tab, then **Project configuration**, then **Environment variables**
4. *Add a variable* (single)
5. Set the key to `PUBLIC_OWNER_MSS`
6. Set the value to your copied account ms in brackets (e.g. `[12345678]`)
7. *Create variable*
8. Go to **Deploys**, then **Trigger deploy**, then **Deploy project**

Now, your account ms will have owner rights within the Mindapp instance. This will give you access to the `/owner-view` which allows you to see all posts, spaces, and accounts on your instance as well the ability to ban accounts, set the email pattern for who can sign into your instance, and basically give you admin-like rights for any space.


## Development

Believe it or not, most of the code for Mindapp is handwritten. Over 95% of it - easily. This was mainly to get the project pointed in the right direction. I now leave the rest of the development up to whoever would like to contribute. I have other things to do so the most I can do for Mindapp is make small changes, review pull requests, and mentor contributors (to keep the quality high and the vision focused, you know?).

I'm not opposed to AI code as long as it can be reasonably explained to me.

Truth be told, I'm too scared to install an AI agent on my computer. What I'll do instead is pack the codebase into an AI-friendly format using: https://repomix.com/?repo=https%3A%2F%2Fgithub.com%2Fmileung%mindapp

and just paste that into some LLM online. I don't really care for having a more advanced development setup than that because Mindapp, as it is right now, is good enough for me. It is the substrate for which any and all information can flow through. And it's great.

That being said, there's still tons of work to be done on Mindapp. There's lots of low hanging bugs to fix for PC users since I primarily use Mindapp on a macOS machine. I am slowly moving towards Linux though. If you'd like to contribute but don't know where to start, search the codebase for `TODO`. There's plenty of things to fix! Beyond that, I'd say get your own instance of Mindapp running, edit the extension code to work for your url (very small codebase for that, so should be simple), and start using Mindapp as part of your note taking workflow so you can passively get ideas on what to improve.