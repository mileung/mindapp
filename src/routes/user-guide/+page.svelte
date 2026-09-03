<script lang="ts">
	import { linkClass } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import CoreParser from '../CoreParser.svelte';
	let txt = `
# User Guide

Where do I begin...

Well Mindapp is a tool that organizes text. That's basically it. The text can be anything you want, so for me that's usually links from the internet. It's a simple tool. Very utilitarian. There aren't too many features, just as I intended, and it does what I want most of the time. There are some situations that could be improved, but I'm happy with where this tool is at.

It's also open source. Anyone is welcome to contribute. Send me an email if you need help with that.

At this point, I've been taking notes for years. Not for school, not for any immediate apparent use, just for the unlikely event where I want to recall something. I actually remember taking my first notes in the cafeteria at a summer camp. It's somewhere... maybe. I didn't have a system back then. I was still in high school. That's the thing, taking notes is easy. Retrieving notes is hard, was hard anyways. I have a system now. It's called Mindapp and it is the result of many years of living. It's easy to add notes, even easier to retrieve them, and... There's just a bunch of little things built in that are all in alignment with my values. That took a lot of time and effort to get everything in its right place.

Right, how to use Mindapp. Hm... Well this is my typical Mindapp workflow.

1. Let's say I visit a webpage. Could be anything.

2. Is this webpage I'm on note worthy? That's a judgement call. I have a deep appreciation for the mundane, so good chance it's noteworthy to me.

3. Do I have the Mindapp extension installed on this device? Yes? Good. If not, like if I'm on my phone, that browser's tabs are synced with my desktop's browser, so later, I'll open up my mobile tabs on desktop so I can save them in Mindapp.

4. \`Alt m\` to open the Mindapp popup. If that doesn't work, click the pinned Mindapp extension icon

5. A popup opens in the top right of my screen in the last "space" I viewed and the \`PostWriter\` is prepopulated with some data scraped from the webpage i'm currently on

6. Am I in the right space? No? \`Command Ctrl Arrow up/down\` to the space I want to post to.

7. Add some tags that describe the webpage, but more importantly, add tags that I can immediately associate with the content. Did a friend share the link? I'm tagging the post with their name. That way I can retrieve notes by just the name of the person who told me.

8. \`Command Enter\` to submit the post. If that doesn't work, click the up arrow in the \`PostWriter\`

And that's it. It can be a quick process if you want. Just don't add any tags. It'll be harder to retrieve later on, so I usually take my time with what tags to add. Maybe ask AI what the year and genre of something is, add those as tags. I'm basically a data labeler, but for my notes.

Sounds like a hassle? It's part of the learning process. If I don't take the time to really think about what tags to add to a post, I'll probably forget I ever even consumed that content and if that's the case, what was even the point of me consuming it? I'm here to learn and retain information.

And now how to retrieve notes. Easy. Here's a typical scenario:

1. On any \`PostFeed\`, you'll see a \`SearchBar\` on the bottom. Click on it and a query guide will show up. I usually ignore that, but it's helpful for if I want to do a complex query.

2. Think of what I want to retrieve and the tags that might be associated with it

3. Start typing into the \`SearchBar\` and it'll start autocompleting tags you have saved (you can save tags on a space's \`/tags\` page or whenever you add a post with new tags)

4. \`Arrow up/down\` to the tag I want to filter by and press \`Enter\`. This will add a tag to the query as indicated by the \`[<tag name>]\` syntax (manually typing it in works too, but this is way faster)

5. Press \`Enter\` again to search and see what shows up. Retrieving old notes is easy if you're good with tags.

Tagging is sort of an art, but not really. I find it useful to think of tags as *hooks*, not descriptors. The whole point of tags is to make finding things easier. So if I have a common word or name related to a idea, that's what I'll likely filter by as a tag the next time I want to retrieve that note.

There's a bunch more features in Mindapp, creating spaces, inviting peers, setting visibility/permissions/roles. Very boring stuff, but it's there.

I should also mention you need to be a member of the Global space in order to do most of anything on Mindapp. In the past, I have made websites where anyone could just post anything for everyone to see. It almost always gets abused. Just give it time. So for any instance of Mindapp, someone has to invite you to the Global space. And if you don't know anyone who can invite you or you just want more control over your data, you can spin up your own instance. The docs for that are in the source code \`README.md\`.

So that was the user guide. Just giving you an idea of why this tool was built, some of the ideas that went into it... I use it everyday. I think you should give it a try. Welcome to the information age!

Source code: https://github.com/mileung/mindapp
`;
</script>

<div class="fy">
	<div style="zoom: 1.5" class="p-4 lg:mt-8 mb-8 w-full space-y-7 max-w-xl font-serif">
		<!-- <div class="p-4 lg:mt-8 mb-8 text-xl lg:text-2xl w-full text-left space-y-7 max-w-4xl font-serif"> -->
		<CoreParser core={txt} depth={0} />
		<!-- <p>I recommend having this page on the side so you can follow along. </p> -->

		<p class="">
			<a class={linkClass} href="/privacy-policy">{m.privacyPolicy()}</a>
		</p>
	</div>
</div>
