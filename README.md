# Mindapp - [mindapp.cc](https://mindapp.cc)

## Simply put
If a thought is whatever pops up in your mind, Mindapp is the **open source thought organizer**.

## Why Mindapp is useful

Thoughts are organized by **set theory** which allows you to classify single thoughts under multiple parent tags - unlike folders which only allow one.

Thoughts are stored in "spaces". There is your **personal space** which is local to your computer and there are **communal spaces** which are on the web. Communal spaces allow multiple users to share thoughts in the same domain. Your personal space is only available when you run Mindapp locally.

**Personas** are used for identifying distinct authors. Each persona has a **public key** ID and a **private key** to **digitally sign** thoughts. This allows users to **verify** the authenticity of each thought. It is normal for one person to have **multiple personas** for different scenarios.

## When running Mindapp locally
- You can use Mindapp offline
- All thoughts that appear in your feed are **saved** on your computer.
- You get a browser extension for saving thoughts faster

## Other features
- Profile pictures are **deterministically generated** from public key IDs. This makes impersonating other users difficult as everyone will have a slightly different look (sort of like faces).
- If a communal space is shut down for whatever reason, a clone can be **independently** spun up with the **same data integrity** because each thought is digitally signed by the author.

## Motivations for building Mindapp
I like learning things. It's free and it helps me make better decisions. Because of this, I've became a prolific note taker.

I started off with Apple Notes. It was fine for years until I had so many notes on it that the search feature became slow and unpredictable. What's the point of saving notes if you can't retrieve them?

So I exported all of my Apple Notes to Markdown and kept my notes in a nested folder of Markdown files. I did this for a few years and it was great because my text editor had a much faster and predictable text search, but there were a couple issues...

1. If I had a note and it could be categorized under two or more folders, I would paste the same text into multiple files.
2. If I wanted to save a note related to a previous note, but did not fit the same category, I'd have to paste the link from the first note with the second note in another file to show that they were related.
3. I didn't have a way to share my notes with my friends. Everyone I showed my Markdown note taking system to was surprised by how vast yet simple it was but there was no easy way to share the knowledge with them.

I let these problems linger for a while because I didn't know what to do. I knew about other note taking apps that used graph theory to show relations between notes and categories, but the switching cost seemed too high for what I thought wouldn't solve all my problems.

The impetus for starting Mindapp was my friend Zain who was brainstorming an AI project. He needed a frontend to input high and low quality data for retrieval-augmented generation. I mulled over it for a bit and thought, that's doable, but what is the incentive for anyone to input enough data for it to be useful? There was none. Then I thought, some social medias already have pretty well organized data. The main problem was that it would probably be against their policies to use their data for our use case.

At this point it was early 2024 and social media already had a reputation for being addictive, demoralizing, and degenerate. Not only that, social media seemed to be a wheel that kept getting reinvented - mainly differing in how they were moderated.

I thought there should be an open source social media that anyone could spin up and share information with. Eventually, there would be multiple instances that use the same schema for storing thoughts. If one instance were to shut down, you could just port over your thoughts to another instance and the same information would be in another place on the web.

Another problem about social media that didn't seem to be solved yet was: How do you exit? You could quit, but there's no way to take out and move your history to other more healthy social media platforms. So if the platform you've built a digital persona on goes down,you're out of luck.

So I had my Markdown note taking system which was good but not perfect and an AI project that led me to think about how social media could be improved. These two ideas would eventually converge when I thought of the following thesis: **note taking apps, chat apps, and social media apps are the same thing**. Note taking apps are like chat apps with yourself, chat apps are like more private social media apps, and the main difference between these was just the **level of privacy**. That then led the direction of the mindapp's UI which is like a cross between Hacker News, Reddit, and Twitter.

Mindapp started out as a personal note taking app mainly because I wanted to solve my own problems first. I implemented:
- A local file organization system for personal space
- A schema for thoughts so that each thought could be represented by a single JSON file or SQLite table row
- Tags to categorize my thoughts and set theory to create relationships between tags
- Recursive replying to other thoughts
- Mentioning other thoughts in a thought
- Automatic git backups
- Browser extension for quickly adding thoughts while surfing the web.

Once this was finished, I started working on a communal space that I could share notes to. As previously mentioned, one problem I saw in typical social media was not being able to exit and move your history to another platform. This maybe due to initial technical limitations but also business incentives keeping the switching cost high. We can do better!

A powerful primitive that crypto introduced to the web that isn't widespread yet is permissionless identity. With most websites, you log in with email or username and password. The problem here is that you're relying on third parties to be the access point for your digital identity. It will only work so long as their servers are intact and running. Using the public/private key paradigm that crypto introduced, you can log into multiple websites with the same persona without relying on any third parties because now **users control their login credentials instead of the application**.

At this point Mindapp is still in active development. It's a tool I use everyday and I hope you find it useful too!

---

old stuff

Client is deployed on Netlify
API is deployed on Fly.io
DB is hosted on Turso

Use a custom domain
https://fly.io/docs/networking/custom-domain/?utm_campaign=first-release&utm_medium=email&utm_source=flyio


# Point-in-Time Recovery
For when you accidentally ruin the db
https://docs.turso.tech/features/point-in-time-recovery

```zsh
$ turso db create mindapp --from-db test --timestamp 2024-05-17T05:07:38.060Z
```

```js
// run this to get lat
const second = 1000;
const delay = 30 * second;
const lastThoughtCreateDate = 1715922428060;
const date = new Date(lastThoughtCreateDate + delay);
const rfc3339Timestamp = date.toISOString();
console.log(rfc3339Timestamp);
```