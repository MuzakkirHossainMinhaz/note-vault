import dotenv from "dotenv";
import mongoose from "mongoose";
import Note from "../src/models/Note";
import Post from "../src/models/Post";
import User, { UserRole } from "../src/models/User";

dotenv.config();

interface DemoPost {
  title: string;
  content: string;
}

interface DemoUser {
  email: string;
  name: string;
  interests: string[];
  notes: DemoPost[];
  posts: DemoPost[];
}

const demoUsers: DemoUser[] = [
  {
    email: "alice@demo.app",
    name: "Alice Johnson",
    interests: ["chess", "reading"],
    notes: [
      { title: "Weekly planning", content: "Review goals for the week and block time for deep work." },
      { title: "Chess opening ideas", content: "Try the Queen's Gambit and the London System as white." },
      { title: "Book list", content: "Finish the novel on my desk, then start the history book." },
      { title: "Grocery list", content: "Oats, eggs, spinach, tomatoes, olive oil, lemons." },
      { title: "Meeting notes", content: "Discussed the roadmap, deadlines, and who owns each task." },
      { title: "Gift ideas", content: "A notebook for Bob, a plant for Carol, a board game for Dave." },
      { title: "Reading log", content: "Chapter summaries and favorite quotes from this month." },
    ],
    posts: [
      { title: "Why I love chess", content: "Chess teaches patience, planning and learning from mistakes." },
      { title: "Three books worth reading", content: "A short list of books that changed how I think." },
      { title: "Building a reading habit", content: "Twenty minutes a day beats a weekend marathon." },
    ],
  },
  {
    email: "bob@demo.app",
    name: "Bob Martinez",
    interests: ["chess", "running"],
    notes: [
      { title: "5K training plan", content: "Run Monday, Wednesday and Saturday, with stretching on Friday." },
      { title: "Endgame practice", content: "Rook endgames: Lucena and Philidor positions." },
      { title: "Budget", content: "Rent, transport, food, savings; review at the end of the month." },
    ],
    posts: [
      { title: "Starting to run", content: "My first month of running: what worked and what hurt." },
      { title: "Chess and running", content: "Both reward steady practice and a calm head." },
      { title: "Tips for beginners", content: "Start slow, sleep well, and keep a simple log." },
    ],
  },
  {
    email: "carol@demo.app",
    name: "Carol Nguyen",
    interests: ["reading", "yoga"],
    notes: [
      { title: "Morning yoga", content: "Ten minute sun salutation routine before breakfast." },
      { title: "Reading goals", content: "Two books this month, one fiction and one non-fiction." },
      { title: "Trip ideas", content: "Lisbon in spring, Kyoto in autumn." },
    ],
    posts: [
      { title: "Yoga for busy mornings", content: "A short routine that fits before work." },
      { title: "Reading and relaxing", content: "How I unwind with a book and a stretch." },
    ],
  },
  {
    email: "dave@demo.app",
    name: "Dave Okafor",
    interests: ["running", "yoga", "chess"],
    notes: [
      { title: "Interval runs", content: "Eight rounds of one minute fast, one minute easy." },
      { title: "Yoga flow", content: "Hip openers and hamstring stretches after long runs." },
      { title: "Chess club", content: "Meet on Thursdays, bring the travel set." },
    ],
    posts: [
      { title: "Interval training basics", content: "Short hard efforts with easy recovery build speed." },
      { title: "Recovery matters", content: "Yoga on rest days kept me injury free." },
    ],
  },
];

async function seedEntries<T extends DemoPost>(
  entries: T[],
  count: number,
  createEntry: (entry: T) => Promise<unknown>,
  label: string,
  email: string,
): Promise<number> {
  if (count > 0) {
    console.log(`Skipped ${label} for ${email}: existing entries found.`);
    return 0;
  }

  for (const entry of entries) {
    await createEntry(entry);
  }

  console.log(`Created ${entries.length} ${label} for ${email}.`);
  return entries.length;
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required to seed demo data.");
  }

  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 8) {
    throw new Error("DEMO_PASSWORD is required and must be at least 8 characters.");
  }

  try {
    await mongoose.connect(mongoUri);
    const databaseName = mongoose.connection.db?.databaseName;
    if (!databaseName) {
      throw new Error("Could not determine the connected database name.");
    }

    let usersCreated = 0;
    let notesCreated = 0;
    let postsCreated = 0;

    for (const demoUser of demoUsers) {
      let user = await User.findOne({ email: demoUser.email });
      if (user) {
        console.log(`Skipped user ${demoUser.email}: already exists.`);
      } else {
        user = await new User({
          email: demoUser.email,
          name: demoUser.name,
          interests: demoUser.interests,
          password: demoPassword,
          role: "user" satisfies UserRole,
        }).save();
        usersCreated += 1;
        console.log(`Created user ${demoUser.email}.`);
      }

      const noteCount = await Note.countDocuments({ owner: user._id });
      notesCreated += await seedEntries(
        demoUser.notes,
        noteCount,
        (note) => new Note({ owner: user._id, ...note }).save(),
        "notes",
        demoUser.email,
      );

      const postCount = await Post.countDocuments({ author: user._id });
      postsCreated += await seedEntries(
        demoUser.posts,
        postCount,
        (post) => new Post({ author: user._id, ...post }).save(),
        "posts",
        demoUser.email,
      );
    }

    console.log(`Database: ${databaseName}`);
    console.log(`Created in this run: ${usersCreated} users, ${notesCreated} notes, ${postsCreated} posts.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && (
    error.message === "MONGO_URI is required to seed demo data."
    || error.message === "DEMO_PASSWORD is required and must be at least 8 characters."
    || error.message === "Could not determine the connected database name."
  )) {
    console.error(error.message);
  } else {
    console.error("Demo data seeding failed; details omitted to protect configuration secrets.");
  }
  process.exitCode = 1;
});
