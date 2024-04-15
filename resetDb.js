const client = require("./lib/db");

async function resetDatabase() { 

    try {
        await client.connect();
        await client.db("activitypub").dropDatabase();
        console.log("Database reset successfully");
    } catch (err) {
        console.error("Error resetting database: ", err);
    } finally {
        await client.close();
    }
}

resetDatabase();