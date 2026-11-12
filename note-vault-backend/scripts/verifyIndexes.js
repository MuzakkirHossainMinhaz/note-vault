const { MongoClient, ObjectId } = require("mongodb");

async function explainQuery(label, executor) {
  const result = await executor();
  const text = JSON.stringify(result && result.queryPlanner ? result.queryPlanner.winningPlan : result || {});
  const isIXSCAN = /IXSCAN/.test(text);
  const isCOLLSCAN = /COLLSCAN/.test(text);
  const indexName = text.match(/indexName\":\"([^\"]+)\"/)?.[1] || "n/a";
  const totalDocsExamined = result && result.executionStats ? result.executionStats.totalDocsExamined : "n/a";
  const nReturned = result && result.executionStats ? result.executionStats.nReturned : "n/a";
  console.log(`\n${label}`);
  console.log(`Plan: ${text}`);
  console.log(`Index: ${indexName}`);
  console.log(`Docs examined: ${totalDocsExamined} | Returned: ${nReturned}`);
  console.log(`Status: ${isIXSCAN && !isCOLLSCAN ? "PASS" : "FAIL"}`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required.");
  }

  const client = new MongoClient(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 5,
  });
  await client.connect();
  const db = client.db();
  const users = db.collection("users");
  const notes = db.collection("notes");
  const posts = db.collection("posts");

  console.log("User indexes:", await users.indexes());
  console.log("Note indexes:", await notes.indexes());
  console.log("Post indexes:", await posts.indexes());

  const createdUserIds = Array.from({ length: 2000 }, () => new ObjectId());
  await users.insertMany(
    createdUserIds.map((id, index) => ({
      _id: id,
      name: `User ${index}`,
      email: `user${index}_${Date.now()}@example.com`,
      password: "Password123",
      role: index % 13 === 0 ? "admin" : "user",
      interests: ["reading", "music", "travel", "tech"].slice(0, (index % 4) + 1),
    })),
  );

  const targetUser = new ObjectId();
  const tempEmail = `login_${Date.now()}@example.com`;
  await users.insertOne({
    _id: targetUser,
    name: "Target User",
    email: tempEmail,
    password: "Password123",
    role: "user",
    interests: ["reading", "music"],
  });

  const noteIds = Array.from({ length: 5000 }, () => new ObjectId());
  await notes.insertMany(
    noteIds.map((id, index) => ({
      _id: id,
      owner: targetUser,
      title: `Note ${index}`,
      content: `Body ${index}`,
      createdAt: new Date(Date.now() - index * 1000),
    })),
  );

  const postIds = Array.from({ length: 3000 }, () => new ObjectId());
  await posts.insertMany(
    postIds.map((id, index) => ({
      _id: id,
      author: targetUser,
      title: `Post ${index}`,
      content: `Body ${index}`,
      createdAt: new Date(Date.now() - index * 1000),
    })),
  );

  await explainQuery("Login lookup by email", async () =>
    users.find({ email: tempEmail }).hint({ email: 1 }).explain("executionStats"),
  );
  await explainQuery("List my notes", async () =>
    notes.find({ owner: targetUser }).sort({ _id: -1 }).hint({ owner: 1, _id: -1 }).explain("executionStats"),
  );
  await explainQuery("Count docs by owner", async () =>
    notes.find({ owner: targetUser }).hint({ owner: 1, _id: -1 }).explain("executionStats"),
  );
  await explainQuery("Admin list users", async () => users.find({}).sort({ _id: -1 }).explain("executionStats"));
  await explainQuery("Admin list all notes", async () => notes.find({}).sort({ _id: -1 }).explain("executionStats"));
  await explainQuery("Get by _id", async () => users.find({ _id: targetUser }).explain("executionStats"));
  await explainQuery("Interests aggregation (no filter)", async () =>
    users
      .aggregate([
        { $match: { interests: { $exists: true } } },
        { $unwind: "$interests" },
        { $group: { _id: "$interests", count: { $sum: 1 }, users: { $push: { _id: "$_id", name: "$name" } } } },
        { $sort: { _id: 1 } },
        { $facet: { data: [{ $skip: 0 }, { $limit: 10 }], total: [{ $count: "count" }] } },
      ])
      .explain("executionStats"),
  );
  await explainQuery("Interests aggregation (with filter)", async () =>
    users
      .aggregate([
        { $match: { interests: "reading" } },
        { $unwind: "$interests" },
        { $match: { interests: "reading" } },
        { $group: { _id: "$interests", count: { $sum: 1 }, users: { $push: { _id: "$_id", name: "$name" } } } },
        { $sort: { _id: 1 } },
        { $facet: { data: [{ $skip: 0 }, { $limit: 10 }], total: [{ $count: "count" }] } },
      ])
      .explain("executionStats"),
  );
  await explainQuery("Posts lookup aggregation", async () =>
    users
      .aggregate([
        { $match: { _id: targetUser } },
        { $project: { name: 1 } },
        {
          $lookup: {
            from: "posts",
            localField: "_id",
            foreignField: "author",
            pipeline: [
              { $sort: { _id: -1 } },
              { $skip: 0 },
              { $limit: 11 },
              { $project: { title: 1, content: 1, createdAt: 1 } },
            ],
            as: "posts",
          },
        },
      ])
      .explain("executionStats"),
  );

  await users.deleteMany({ _id: { $in: [...createdUserIds, targetUser] } });
  await notes.deleteMany({ _id: { $in: noteIds } });
  await posts.deleteMany({ _id: { $in: postIds } });

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
