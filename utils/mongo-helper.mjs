// Mongo-Helper
// ---------------------------------------------------------------------
export const addUserToMongo = async (client, newUser, errRes, successRes) => {
  const db = await client.db("reskill");
  const collection = await db.collection("users");

  collection.insertOne(newUser, function (err, res) {
    if (err) errRes(err);
    else successRes();
  });
};

export const deleteFromMongo = async (client, userId) => {
  const db = await client.db("reskill");
  const collection = await db.collection("users");
  collection.deleteOne({ _id: userId });
};

export const deleteAllFromMongo = async (client) => {
  const db = await client.db("reskill");
  const collection = await db.collection("users");
  collection.remove({});
};

export const getFromMongo = async (client) => {
  const db = await client.db("reskill");
  const collection = await db.collection("users");

  return await collection.find().limit(100).toArray();
};
