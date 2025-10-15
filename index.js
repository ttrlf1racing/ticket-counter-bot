require("dotenv").config();
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
});

// 🧩 CATEGORY MAP
// Format: "CategoryID": "CounterChannelID"
const CATEGORY_MAP = {
  "1330176823157587988": "1427990289158639668", // T1
  "1397564599653371945": "1427992666154733639", // T2
  "1378660136813596772": "1427993025241550971", // T3
  "1402961050927763618": "1427993294880903299", // T4
  "1402961328209006672": "1427993548971577404"  // REAL
};

// 🧮 Count active tickets (ignore closed + counter channel)
function countTicketsInCategory(guild, categoryId) {
  const displayChannelId = CATEGORY_MAP[categoryId];
  return guild.channels.cache.filter(ch =>
    ch.parentId === categoryId &&
    ch.type === ChannelType.GuildText &&
    ch.id !== displayChannelId && // ignore counter channel itself
    !ch.name.startsWith("closed") &&
    !ch.name.startsWith("resolved")
  ).size;
}

// 🔁 Update a single category’s counter channel
async function updateCategoryCount(guild, categoryId) {
  const displayChannelId = CATEGORY_MAP[categoryId];
  const displayChannel = guild.channels.cache.get(displayChannelId);
  const category = guild.channels.cache.get(categoryId);
  if (!displayChannel || !category) return;

  const count = countTicketsInCategory(guild, categoryId);

  // 🏷️ Use the category name (cleaned and formatted)
  const cleanCategoryName = category.name
    .toLowerCase()
    .replace(/\s+/g, "-")        // replace spaces with hyphens
    .replace(/[^a-z0-9\-]/g, ""); // remove special chars

  const newName = `${cleanCategoryName}: ${count}`;

  if (displayChannel.name !== newName) {
    await displayChannel.setName(newName).catch(console.error);
    console.log(`Updated ${displayChannel.name} → ${newName}`);
  }
}

// 🔄 Update all categories
async function updateAllCounts(guild) {
  for (const categoryId of Object.keys(CATEGORY_MAP)) {
    await updateCategoryCount(guild, categoryId);
  }
}

// 🟢 When bot starts up
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  for (const [, guild] of client.guilds.cache) {
    await updateAllCounts(guild);
  }
  console.log("🔄 Ticket counter is active and listening for changes...");
});

// 📥 Channel created
client.on("channelCreate", async channel => {
  if (CATEGORY_MAP[channel.parentId]) {
    await updateCategoryCount(channel.guild, channel.parentId);
  }
});

// 🗑️ Channel deleted
client.on("channelDelete", async channel => {
  if (CATEGORY_MAP[channel.parentId]) {
    await updateCategoryCount(channel.guild, channel.parentId);
  }
});

// ✏️ Channel renamed (e.g. ticket closed)
client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (CATEGORY_MAP[oldChannel.parentId]) {
    if (oldChannel.name !== newChannel.name) {
      await updateCategoryCount(newChannel.guild, oldChannel.parentId);
    }
  }
});

client.login(process.env.TOKEN);
