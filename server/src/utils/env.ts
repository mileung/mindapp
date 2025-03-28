const env = {
	TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
	TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
	GLOBAL_HOST: process.env.GLOBAL_HOST,

	// below are sent to client
	SPACE_NAME: process.env.SPACE_NAME,
	OWNER_ID: process.env.OWNER_ID,
	DOWNVOTE_ADDRESS: process.env.DOWNVOTE_ADDRESS,
	TOKEN_ID: process.env.TOKEN_ID || '',
	CONTENT_LIMIT: Number(process.env.CONTENT_LIMIT) || undefined,
	TAG_LIMIT: Number(process.env.TAG_LIMIT) || undefined,
	ANYONE_CAN_JOIN: process.env.ANYONE_CAN_JOIN === 'true' || undefined,
	ANYONE_CAN_ADD: process.env.ANYONE_CAN_ADD === 'true' || undefined,
	DELETABLE_VOTES: process.env.DELETABLE_VOTES === 'true' || undefined,
	TAG_TREE: {
		parents: {
			AI: ['Artificial Intelligence'],
			'AI SaaS': ['Perplexity'],
			Activism: ['Protest'],
			Actor: ['Keanu Reeves'],
			Advertisement: ['Commercial', 'Engaging Advertisement'],
			Advertising: ['Advertisement'],
			Aesthetic: ['Cute', 'Maximalism', 'Minimalism'],
			Africa: ['African', 'Ghana', 'South Africa'],
			African: ['Africa'],
			Agriculture: ['Fertilizer'],
			Aircraft: ['Drone'],
			Algorithm: ['Data Structure', 'Regular Expression'],
			'Alphabet Inc.': ['YouTube'],
			'Alternative Rock Music': ['Dream Pop Music'],
			Amazon: ['Amazon Review'],
			'Ambient Electronic Music': ['Ambient Jungle Music'],
			Analysis: ['Case Study', 'Market Research', 'Review'],
			Anatomy: ['Human Anatomy', 'Skin'],
			Animal: ['Baboon', 'Bird', 'Bug', 'Chicken'],
			Aphorism: ['Latin Aphorism'],
			'Apple Inc.': ['iOS', 'mac', 'Mac Mini', 'macOS', 'Shot on iPhone', 'Steve Jobs'],
			Architecture: [
				'Construction Material',
				'Geodesic Dome',
				'Hostile Architecture',
				'Housing',
				'Insulation',
				'Plumbing',
			],
			Art: [
				'Aesthetic',
				'Architecture',
				'Cryptography',
				'Dance',
				'Impermanent Art',
				'Interior Design',
				'Sculpting',
				'Sculpture',
				'Unintentional Art',
			],
			Artifact: ['Souvenir'],
			'Artificial Intelligence': ['AI', 'AI Limitation', 'AI Music', 'AI SaaS', 'AI Video'],
			Asia: ['Asian', 'East Asia', 'Indonesia', 'Southeast Asia'],
			Athlete: ['Fighter', 'Japanese Athlete'],
			'Audio Gear': ['Earbud', 'Microphone'],
			Aviation: ['Aircraft', 'Airline'],
			Baseball: ['Basketball Player'],
			Bathroom: ['Onsen'],
			'Bay Area': ['Oakland', 'r/bayarea', 'r/Gunn', 'San Francisco', 'San Jose', 'Silicon Valley'],
			Beekeeping: ['Bee Behavior', 'Beehive'],
			Bicycle: ['Bicycle Framebuilding'],
			Boating: ['Catamaran'],
			Book: ['Book Review', 'Ebook', 'Textbook'],
			Brazil: ['Bossa Nova'],
			Bureaucracy: ['Leadership'],
			Business: [
				'Business Acquisition',
				'Business Philosophy',
				'Business Pivot',
				'Enshittification',
				'Market Research',
				'Marketing',
				'Sales',
			],
			CAD: ['Computer-Aided Design'],
			CLI: ['Command-Line Interface'],
			CSS: ['Cascading Style Sheets'],
			California: ['Bay Area', 'Los Angeles', 'San Diego'],
			Camping: ['Sleeping Bag'],
			Canada: ['Asian Canadian'],
			Car: ['Pickup Truck'],
			'Car Industry': [
				'Autonomous Vehicle',
				'Car',
				'Car Maintenance',
				'Car Restoration',
				'Self-Driving Car',
			],
			Cartoon: ['Boondocks', 'King of the Hill', 'South Park', 'SpongeBob'],
			'Cascading Style Sheets': ['CSS'],
			Chicken: ['Poultry Farming'],
			China: [
				'Beijing',
				'Chinese American Cultural Export',
				'Chinese Cultural Export',
				'Chinese Food',
				'Chinese Language',
				'Hong Kong',
			],
			'Chinese Cultural Export': [
				'Chinese Food',
				'Chinese Language',
				'Chinese Music',
				'Chinese Proverb',
				'Go Board Game',
			],
			'Chinese Language': ['Cantonese Language', 'Learn Chinese', 'Mandarin Language'],
			'Chinese Music': ['純音樂 - Topic'],
			Cinematography: [
				'Animation',
				'Documentary',
				'Movie',
				'Shot on iPhone',
				'Stop Motion',
				'TV Show',
				'Video Genre',
			],
			City: ['San Diego', 'San Francisco'],
			Clothing: ['Shoe'],
			'Cloud Platform': ['Fly.io', 'SaaS'],
			Coding: ['Debugging'],
			College: ['College Admissions', 'Ivy League', 'MIT', 'Princeton'],
			Comedian: ['Donald Glover', 'Key & Peele', 'Sam Hyde'],
			'Comedic Music Artist': ['Hank Trill', 'Jonathan Coulton'],
			Comedy: [
				'Blooper',
				'British Humor',
				'Comedian',
				'Comedic Remark',
				'Comedy Movie',
				'Funny',
				'Funny Music',
				'Impression',
				'Joke',
				'Parody',
				'Satire',
				'Skit',
				'Stand-Up Comedy',
				'Unintentional Humor',
			],
			'Command-Line Interface': ['CLI'],
			Commerce: ['E-Commerce'],
			Communication: [
				'Brutally Honest Remark',
				'Clarification',
				'Debate',
				'Interview',
				'Linguistics',
				'Mail',
				'Monologue',
				'News Broadcasting',
				'Presentation',
				'Smartphone',
			],
			Company: [
				'Alphabet Inc.',
				'Amazon',
				'Anduril Industries',
				'Apple Inc.',
				'Media Company',
				'Meta Platforms, Inc.',
				'Microsoft',
				'Reddit',
				'Startup',
				'Stripe, Inc.',
				'Tech Company',
				'Twitter',
				'UFC',
			],
			Computer: ['Command-Line Interface', 'Computer Networking', 'File System', 'Software'],
			'Computer Hardware': ['Laptop', 'Raspberry Pi'],
			'Computer Networking': ['Internet'],
			'Computer Science': ['Computer Vision', 'Data Structure', 'Large Language Model'],
			'Computer-Aided Design': ['CAD'],
			Condition: ['COVID-19', 'Degeneracy', 'Disability', 'Eczema', 'Obesity'],
			'Consumer Awareness': ['Grift'],
			Consumerism: ['Consumer Awareness', 'For Sale'],
			Continent: ['Africa', 'Asia', 'Europe'],
			Cooking: ['Ingredient', 'Learn to Cook'],
			Country: [
				'Brazil',
				'Britain',
				'Canada',
				'China',
				'Dubai',
				'Germany',
				'Ghana',
				'India',
				'Indonesia',
				'Island Country',
				'Israel',
				'Italy',
				'Jamaica',
				'Japan',
				'Korea',
				'Mexico',
				'Micronation',
				'Network State',
				'North Korea',
				'Philippines',
				'Portugal',
				'Russia',
				'Saudi Arabia',
				'South Africa',
				'South Korea',
				'Switzerland',
				'Taiwan',
				'Thailand',
				'United States of America',
				'Vietnam',
			],
			'Creator Economy': ['Content Creation Gear'],
			Cryptocurrency: ['Blockchain Protocol', 'Tokenomics'],
			Cryptography: ['Cryptocurrency'],
			Culture: ['Asian', 'Cultural Appropriation', 'Internet', 'Meme'],
			Cycling: ['Bicycle', 'Bike Route', 'Bike Trail'],
			DIY: ['Do It Yourself'],
			DJ: ['DJ Mix'],
			'Data Storage': ['Database', 'PocketBase', 'SQLite'],
			Dessert: ['Candy', 'Ice Cream', 'Pastry'],
			Destruction: [
				'Crash',
				'Explosion',
				'Fire',
				'Manmade Disaster',
				'Mass Casualty Incident',
				'Natural Disaster',
			],
			'Do It Yourself': ['DIY', 'Repair'],
			Documentary: ['r/Documentaries'],
			Drama: ['Hoax', 'Lawsuit'],
			'E-Commerce': ['Online Store'],
			'East Asia': ['China', 'Japan', 'Korea', 'North Korea', 'South Korea', 'Taiwan', 'Vietnam'],
			Eatery: ['Bakery', 'Restaurant'],
			Education: ['Language Learning', 'Mnemonic', 'Teaching English'],
			Efficiency: ['Low-cost'],
			'Electrical Engineering': [
				'Battery',
				'Downtempo Music',
				'E Ink',
				'Electric Transportation',
				'MOSFET',
			],
			'Electronic Music': ['Ambient Electronic Music'],
			Engineering: ['Civil Engineering', 'Electrical Engineering', 'Robot'],
			Entrepreneur: ['Solopreneur'],
			Entrepreneurship: [
				'Entrepreneur',
				'Indie Hacking',
				'r/Entrepreneur',
				'Side Hustle',
				'Startup',
				'Y Combinator',
			],
			Environmentalism: ['Efficiency', 'Pest Control', 'Repurpose'],
			Era: ['1960s', '1970s', '1980s', '1990s', '2000s'],
			Estate: ['Real Estate'],
			Ethics: ['Parable'],
			Europe: ['European History', 'France', 'Germany', 'Italy', 'Spain'],
			Event: [
				'Ceremony',
				'Competition',
				'Meetup',
				'Music Festival',
				'Online Event',
				'Recurring Event',
				'Unsanctioned Event',
			],
			'Exceptional Person': [
				'Balaji Srinivasan',
				'Child Prodigy',
				'Donald Trump',
				'George Hotz',
				'Hayao Miyazaki',
				'Masanobu Fukuoka',
				'Steve Jobs',
				'Terence McKenna',
			],
			Exercise: ['Calisthenics', 'Dance'],
			Farming: ['Cattle', 'Farming Practice', 'Land', 'Poultry Farming', 'Soil'],
			'Farming Practice': ['Aquaculture', 'Industrial Agriculture', 'Permaculture'],
			Fashion: ['Clothing'],
			Fighter: ['Bob Sapp', 'Boxer'],
			Finance: ['Inflation', 'Option Trading', 'Tax'],
			Fishing: ['Seafood'],
			Food: ['Chicken', 'Cooking', 'Dessert', 'Seafood'],
			'Foreign Music': [
				'Chinese Music',
				'Greek Term',
				'Indian Music',
				'Japanese Music',
				'Korean Music',
				'Thai Music',
			],
			'Foreign Term': ['Arabic Term', 'French Term', 'Japanese Term', 'Korean Term'],
			France: ['French Language'],
			'French Language': ['French Term'],
			Fungus: ['Mushroom'],
			'Funny Music': ['Comedic Music Artist'],
			Gadget: ['Audio Gear', 'Content Creation Gear'],
			Gambling: ['Poker', 'Sports Betting'],
			'Gen Z': ['Gen Z Humor'],
			Generation: ['Baby Boomer Generation', 'Gen Alpha', 'Gen Z'],
			Geography: ['Continent', 'Country', 'Latin America', 'Nordic Country'],
			Glitch: ['Zero Day'],
			'Go Board Game': ['Go Board Game'],
			Governance: ['Government Job', 'Politics'],
			'Graphic Art': ['Animation', 'Blender', 'User Interface', 'Visual Artist'],
			'Group of People': ['Community', 'Cult', 'Society'],
			'Gunn High School': ['r/Gunn'],
			Health: [
				'Alternative Medicine',
				'Anatomy',
				'Body Skill',
				'Exercise',
				'First Aid',
				'Hair Care',
				'Home Remedy',
				'Mental Health',
				'Nutrition',
				'Physical Rehabilitation',
				'Safety',
				'Sleep',
				'Yoga',
			],
			'High School': ['Gunn High School'],
			Hiring: ['Outsourced Labor'],
			History: ['Era'],
			Hobby: [
				'3D Printing',
				'Art',
				'Beekeeping',
				'Bicycle',
				'Boating',
				'Camping',
				'Collection',
				'Fishing',
				'Gardening',
				'Guitar',
				'Photography',
				'Sculpting',
				'Soap Making',
				'Sport',
				'Volunteering',
				'Woodworking',
				'Yoga',
			],
			Housing: [
				'Couch Surfing',
				'Free Room and Board',
				'Home Feature',
				'Homestay',
				'Microapartment',
				'Section 8',
				'Shipping Container Housing',
				'Studio Tour',
			],
			Idea: ['Ideology'],
			Ideology: ['Fascism'],
			Illinois: ['Chicago'],
			India: ['Indian Culture'],
			Indonesia: ['Bali'],
			'Industrial Society': [
				'Food Delivery',
				'Industrial Agriculture',
				'Machining',
				'Manufacturing',
			],
			Ingredient: ['Coconut Oil'],
			Instrument: ['Guitar', 'Piano', 'Saxophone'],
			'Interior Design': ['Furniture'],
			Internet: ['Cybersecurity', 'Internet Browser', 'Internet Protocol', 'Network State'],
			'Internet Browser': ['Chrome Extension'],
			'Internet Protocol': ['Blockchain Protocol'],
			Interview: ['Street Interview'],
			Italy: ['Rome'],
			Japan: [
				'Anime',
				'Japan Countryside',
				'Japanese American',
				'Japanese Cultural Export',
				'Japanese Language',
				'Japanese Music',
				'Japanese Village',
				'Kyoto',
				'r/japan',
				'r/JapanFinance',
				'Tokyo',
			],
			'Japanese Cultural Export': [
				'Engrish',
				'Japanese Food',
				'Japanese Humor',
				'Japanese Language',
				'Japanese Movie',
				'Japanese Music',
			],
			'Japanese Language': ['Japanese Saying', 'Japanese Term'],
			'Japanese Music': ['Anime Music', 'Denpa Music', 'Serani Poji - Topic', '聞人聽書_ - Topic'],
			'Japanese Music Artist': ['Coda', 'Joe Hisaishi Official', 'Joe Inoue'],
			'Japanese Term': ['Japanese Slang', 'Japanese Vocabulary List', 'Onsen'],
			JavaScript: ['Three.js'],
			'Joe Hisaishi Official': ['YouTube@joehisaishivevo3979'],
			'Joe Inoue': ['Joe Inoue Official English'],
			Journalism: ['Journalist'],
			Korea: ['Korean Music', 'Korean Term', 'North Korea', 'South Korea'],
			'Korean Music': ['IU', '장윤주 - Topic'],
			'Korean Term': ['Mukbang'],
			LLM: ['Large Language Model'],
			Labor: [
				'Apprenticeship',
				'Burnout',
				'Business',
				'Cybersecurity',
				'Government Job',
				'Hiring',
				'Job Automation',
				'Job Opening',
				'Job Seeking',
				'Layoff',
				'Minimum Wage',
				'Outsourced Labor',
				'Productivity',
				'Quiet Quitting',
				'Quitting',
				'r/careeradvice',
				'Retirement',
				'Service',
				'Side Hustle',
				'Slavery',
				'Work Culture',
			],
			Landform: ['River'],
			'Language Learning': [
				'Bilingual Commentary',
				'Learn Chinese',
				'Learn Japanese',
				'Teaching English',
			],
			Laptop: ['Thinkpad'],
			'Large Language Model': ['LLM'],
			'Latin America': ['Mexico', 'Venezuela'],
			'Learn Japanese': [
				'English with Japanese Subtitles',
				'Japanese with English Subtitles',
				'Japanese with Japanese Subtitles',
				'Practice Japanese',
				'r/LearnJapanese',
			],
			'Legal System': ['Lawsuit', 'Sentencing'],
			'Life Advice': ['r/careeradvice'],
			Lifestyle: [
				'Environmentalism',
				'Expatriate',
				'Gap Year',
				'Indie Hacking',
				'Life Advice',
				'Life Hack',
				'Minimalism',
				'Retirement',
				'Struggle',
				'Travel',
				'Van Life',
			],
			Linguistics: [
				'Acronym',
				'Adjective',
				'Alliteration',
				'Arabic Term',
				'Engrish',
				'Euphemism',
				'Idiom',
				'Initialism',
				'Japanese Language',
				'Korean Term',
				'Language Learning',
				'Literary Technique',
				'Multilingual Music',
				'Portmanteau',
				'Pronunciation',
				'Rhyme',
				'Saying',
				'Semantics',
				'Teaching English',
				'Term',
				'Word',
			],
			Logic: ['Algorithm'],
			Logistics: ['Supply Chain'],
			'Low-cost': ['Do It Yourself'],
			MMA: ['UFC'],
			Machining: ['Lathe'],
			Manufacturing: ['Computer-Aided Design', 'Lathe', 'Metalworking', 'Woodworking'],
			Marketing: ['Advertising'],
			Marketplace: ['Online Marketplace'],
			Marriage: ['Divorce'],
			Maryland: ['Baltimore'],
			Math: ['Data Science', 'Mathematics'],
			Mathematics: ['Cryptography', 'Game Theory', 'Geometry', 'Math', 'Statistics'],
			Meme: ['Clickbait', 'Donald Trump', 'Shrek', 'SpongeBob'],
			Meteorology: ['Weather'],
			Mexico: ['Mexican Cultural Export'],
			Minimalism: ['Digital Minimalism', 'r/minimalism'],
			Miscellaneous: ['Mystery Solved', 'Um...'],
			Money: ['ATM', 'Finance', 'Funding'],
			Movie: [
				'Action Comedy Movie',
				'Comedy Movie',
				'Drama Movie',
				'Romance Movie',
				'Science Fiction Movie',
				'Sports Movie',
				'War Movie',
			],
			Music: [
				'573 - Topic',
				'Cindy - Topic',
				'Colin Willsher - Topic',
				'Collin Lim - Topic',
				'Cover Music',
				'Daniel Perret - Topic',
				'Delacour - Topic',
				'Dorothy Collins - Topic',
				'Earworm',
				'Foreign Music',
				'Home Made Kazoku - Topic',
				'Instrumental',
				'Mashup',
				'Music Album',
				'Music Theory',
				'Opera',
				'potsu',
				'Release - Topic',
				'SEGA SOUND TEAM - Topic',
				'Serani Poji - Topic',
				'Solomon Fox - Topic',
				'Tshxlx Irl - Topic',
				'US Army Field Band - Topic',
			],
			'Music Artist': [
				'Comedic Music Artist',
				'David Bowie',
				'DJ',
				'Donald Glover',
				'Dusqk - Topic',
				'Jack Stauber',
				'Jack Stauber Music',
				'Japanese Music Artist',
				'Ludwig Goransson',
			],
			'Music Genre': [
				'AI Music',
				'Alternative Rock Music',
				'Boinging Music',
				'Bossa Nova',
				'Calming Music',
				'Catchy Music',
				'Cheerful Music',
				'Chill Music',
				'Chinese Music',
				'City Pop',
				'Country Music',
				'Cover Music',
				'Denpa Music',
				'DJ Mix',
				'Drum and Bass',
				'Electronic Music',
				'Elevator Music',
				'Epic Music',
				'Foreign Music',
				'Funny Music',
				'Groovy Music',
				'Grunge Music',
				'Hip Hop',
				'Hipster Music',
				'Indian Music',
				'Indie Pop Music',
				'Japanese Music',
				'Korean Music',
				'Live Rendition',
				'Meme Music',
				'Multilingual Music',
				'Piano Music',
				'Pop Music',
				'R&B Music',
				'Remix',
				'Rock Music',
				'Slow + Reverb Music',
				'Soft Rock Music',
				'Soothing Music',
				'Soul Music',
				'Techno',
				'Thai Music',
				'Trance Music',
				'Vaporwave',
				'Video Game Music',
			],
			'Music Group': ['Marching Band', 'OfficialEels', 'Radiohead', 'Wu-Tang Clan', 'yesofficial'],
			'Music Industry': [
				'Audio Gear',
				'Music',
				'Music Festival',
				'Music Genre',
				'Music Group',
				'Music Production',
			],
			'Music Production': ['Audio Gear', 'Sound Bite'],
			NPC: ['Non-Player Character'],
			NYC: ['New York City'],
			'Natural Disaster': ['Earthquake'],
			Nature: [
				'Agriculture',
				'Animal',
				'Aquaculture',
				'Beekeeping',
				'Environmentalism',
				'Farming',
				'Fungus',
				'Gardening',
				'Landform',
				'Plant',
				'Sex',
				'Soil',
			],
			Nevada: ['Las Vegas'],
			'New York': ['New York City'],
			'New York City': ['NYC'],
			'Non-Player Character': ['NPC'],
			'Nordic Country': ['Iceland', 'Norway'],
			Norway: ['Norwegian Cultural Export', 'r/Norway'],
			Nutrition: [
				'Drink',
				'Eatery',
				'Food',
				'Food Delivery',
				'Food Poisoning',
				'Food Storage',
				'Mukbang',
				'Plant-Based Diet',
			],
			OPSEC: ['Operations Security'],
			OSINT: ['Open Source Intelligence'],
			'Online Marketplace': ['Craigslist'],
			'Open Source': ['Open Source Intelligence', 'Open Source Software'],
			'Open Source Intelligence': ['OSINT'],
			'Open Source Software': ['Blender', 'htmx', 'Linux', 'Node.js'],
			Opera: ['Opera Singer'],
			'Operating System': ['Android', 'Linux'],
			'Operations Security': ['OPSEC'],
			Opinion: ['Criticism'],
			Parenting: ['Adoption'],
			'Party Trick': ['Body Skill'],
			People: ['Chinese Philosopher', 'Past Coworker', "Person I've Met", 'Politician'],
			"Person I've Met": ['Anastasia Shaura', 'Former Classmate'],
			'Person Type': [
				'Actor',
				'African American',
				'Athlete',
				'Celebrity',
				'Child Prodigy',
				'Creator',
				'Exceptional Person',
				'Foreigner',
				'Japanese American',
				'Music Artist',
				'Nerd',
				'Non-Player Character',
				'Scammer',
				'Whistleblower',
				'White Liberal',
			],
			Phenomenon: [
				'Accident',
				'Conspiracy',
				'Conspiracy Theory',
				'Earworm',
				'Glitch',
				'Gray Area',
				'Misconception',
				'Nostalgia',
				'Paradox',
				'Prescient',
				'Uncanny Valley',
				'Viral',
			],
			Philosopher: ['Chinese Philosopher'],
			Philosophy: [
				'Buddhism',
				'Business Philosophy',
				'Epistemology',
				'Marxism',
				'Philosopher',
				'r/askphilosophy',
				'Taoism',
			],
			Photography: ['Photograph', 'Shot on iPhone'],
			Physics: ['Rocket Science'],
			Piano: ['Piano Music'],
			Place: ['Coworking Space', 'Eatery', 'Hackerspace', 'Museum', 'Point of Interest'],
			Plant: ['Cannabis', 'Hygienic Plant', 'Tomato'],
			Podcast: ['Lex Fridman Podcast', 'Podcast Episode', 'The Joe Rogan Experience'],
			Policy: ['Death Penalty', 'Illegal Immigration', 'Martial Law', 'Sentencing', 'Tax'],
			'Political Ideology': [
				'Capitalism',
				'Communism',
				'Corporatism',
				'Marxism',
				'Nimbyism',
				'Wokism',
			],
			Politician: ['Adolf Hitler', 'Donald Trump', 'Joe Biden'],
			Politics: ['Policy', 'Political Gaffe', 'Political Ideology', 'Politician'],
			'Pop Music': ['Pop Rock Music'],
			Portugal: ['Lisbon'],
			Prediction: ['Prescient'],
			'Programming Language': ['JavaScript', 'Learn Programming Language'],
			Protest: ['Quitting'],
			Proverb: ['Chinese Proverb'],
			Psychology: ['Uncanny Valley'],
			Quitting: ['Quiet Quitting'],
			Quote: ['Opinion', 'Personal Anecdote'],
			Reading: ['Biography', 'Book'],
			'Real Estate': ['Real Estate Listing'],
			'Recurring Event': ['Annual Event', 'Olympics', 'Semi-Annual Event'],
			Reddit: ['Reddit Comment', 'Subreddit'],
			Relationships: ['Dating', 'Marriage'],
			Religion: ['Buddhism', 'Christianity', 'Islam', 'Judaism', 'Mormonism'],
			Review: ['Amazon Review', 'Book Review', 'Comparison'],
			'Rock Music': [
				'Alternative Rock Music',
				'Glam Rock Music',
				'Indie Rock Music',
				'Pop Rock Music',
				'Soft Rock Music',
			],
			'Rocket Science': ['Space Travel'],
			Rome: ['Roman Empire'],
			Russia: ['Russian Language'],
			SF: ['San Francisco'],
			SQLite: ['Turso'],
			SaaS: ['Email SaaS'],
			Safety: ['Insurance', 'Operations Security', 'Privacy'],
			Sales: ['Marketing'],
			'San Francisco': ['r/AskSF', 'r/sanfrancisco', 'SF'],
			Saying: ['Aphorism', 'Proverb', 'Quote'],
			Scam: ['Fraud', 'Ponzi Scheme', 'Scammer'],
			Scammer: ['Scam'],
			Science: [
				'Anatomy',
				'Chemistry',
				'Geology',
				'Neuroscience',
				'Physics',
				'Psychology',
				'Rocket Science',
			],
			Sentencing: ['Death Penalty'],
			Sex: ['Procreation'],
			Skin: ['Eczema'],
			'Social Media': ['Facebook', 'Instagram', 'Snapchat', 'TikTok', 'Twitter', 'Vine', 'YouTube'],
			Society: ['Creator Economy', 'Doomsday', 'Dystopia', 'Futurism', 'Industrial Society'],
			Sociology: [
				'Activism',
				'Culture',
				'Ethics',
				'Feminism',
				'Homeless',
				'Immigration',
				'Person Type',
				'Racism',
				'Relationships',
				'Social Norm',
				'Socializing',
				'Society',
				'Welfare',
			],
			Software: ['Database', 'Open Source Software', 'Operating System'],
			'South Korea': ['South Korean Cultural Export'],
			'Southeast Asia': ['Philippines'],
			Spirituality: ['Buddhism'],
			SpongeBob: ['SpongeBob Cultural Export'],
			Sport: [
				'American Football',
				'Baseball',
				'Breakdance',
				'Cycling',
				'Greyhound Racing',
				'Mixed Martial Arts',
				'MMA',
				'Olympics',
				'Running',
				'Skydiving',
			],
			Statistics: ['Statistic'],
			Subreddit: [
				'r/askphilosophy',
				'r/AskSF',
				'r/bayarea',
				'r/careeradvice',
				'r/Documentaries',
				'r/Entrepreneur',
				'r/georgism',
				'r/Gunn',
				'r/htmx',
				'r/japan',
				'r/JapanFinance',
				'r/LearnJapanese',
				'r/LeverGuns',
				'r/MassImmersionApproach',
				'r/migraine',
				'r/MilitaryGear',
				'r/minimalism',
				'r/Norway',
				'r/opensource',
				'r/OutOfTheLoop',
				'r/sanfrancisco',
				'r/solotravel',
				'r/teachinginjapan',
				'r/technology',
				'r/webdevelopment',
				'r/weddingplanning',
				'r/WTF',
			],
			System: ['Broken System', 'Bureaucracy', 'Capitalism', 'Law'],
			'Tech Company': ['Google'],
			'Tech Industry': [
				'Augmented Reality',
				'Autonomous Vehicle',
				'Cloud Platform',
				'Coding',
				'Computer',
				'Computer Science',
				'Cybersecurity',
				'Indie Hacking',
				'Mixed Reality',
				'No Code',
				'Node.js',
				'Self-Driving Car',
				'Software License',
				'Video Game',
				'Virtual Reality',
				'Web Development',
			],
			Term: ['Compound Word', 'Foreign Term', 'Multi-Word Adjective', 'Slang'],
			Thailand: ['Thai Music'],
			TikTok: ['TikTok Comment'],
			'Traditional Education': ['College', 'High School'],
			Train: ['Amtrak'],
			Transportation: [
				'Autonomous Vehicle',
				'Aviation',
				'Bicycle',
				'Electric Transportation',
				'Public Transit',
				'Train',
			],
			Travel: [
				'Expatriate',
				'Point of Interest',
				'Space Travel',
				'Tourism',
				'Travel Restriction',
				'Travel Visa',
			],
			Trivia: ['Phenomenon', 'World Record'],
			Tutorial: ['How to Paint', 'Learn Programming Language', 'Learn to Cook'],
			Tweet: ['Twitter Thread'],
			Twitter: ['Tweet'],
			Typing: ['Computer Keyboard'],
			USA: ['United States of America'],
			'United States Armed Forces': ['United States Navy'],
			'United States of America': [
				'Alabama',
				'American Cultural Export',
				'California',
				'Chinese American Cultural Export',
				'Florida',
				'Illinois',
				'Japanese American',
				'Maryland',
				'Nebraska',
				'Nevada',
				'New York',
				'South Dakota',
				'United States Armed Forces',
				'USA',
			],
			'Urban Planning': ['Civil Engineering', 'Public Transit'],
			'Video Game': ['Browser Video Game', 'Video Game Music'],
			'Video Genre': ['Day in the Life'],
			Wartime: ['War Movie'],
			Water: ['Water Purification', 'Water Storage'],
			Weapon: ['Gun'],
			'Web Development': [
				'Cascading Style Sheets',
				'Fun Website',
				'htmx',
				'Node.js',
				'r/webdevelopment',
				'SEO',
				'SolidJS',
			],
			Wokism: ['Woke'],
			Woodworking: ['Carpentry', 'Woodworker'],
			'Work Culture': ['Hustle Culture'],
			Writing: ['Literary Technique'],
			YouTube: ['YouTube Channel', 'YouTube Comment', 'YouTube Playlist'],
			htmx: ['r/htmx'],
		},
		loners: [
			'Analytics',
			'Comments Disabled',
			'Directory',
			'Gold',
			'Mindapp',
			'Product Design',
			'Satisfying',
		],
	},
};

export default env;
