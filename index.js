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
  "1330176823157587988": "1430160855982673930", // T1
  "1397564599653371945": "1430160780463968277", // T2
  "1378660136813596772": "1430160626411507773", // T3
  "1402961050927763618": "1430160519750225920", // T4
  "1402961328209006672": "1430155833127469227"  // REALISTIC
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

// 🔁 Update a single category’s counter (supports voice or text channels)
async function updateCategoryCount(guild, categoryId) {
  const displayChannelId = CATEGORY_MAP[categoryId];
  const displayChannel = guild.channels.cache.get(displayChannelId);
  let category = guild.channels.cache.get(categoryId);

  // ⏳ If not cached, fetch from API
  if (!category) {
    try {
      category = await guild.channels.fetch(categoryId);
    } catch (err) {
      console.error(`⚠️ Could not fetch category ${categoryId}:`, err.message);
      return;
    }
  }

  if (!displayChannel || !category) return;

  const count = countTicketsInCategory(guild, categoryId);

  // 🏷️ Preserve your current prefix (everything before ":")
  const currentName = displayChannel.name;
  const baseName = currentName.includes(":")
    ? currentName.split(":")[0].trim()
    : currentName.trim();

  const newName = `${baseName}: ${count}`;

  // ✅ Only rename if the count changed
  if (currentName !== newName) {
    await displayChannel.setName(newName).catch(console.error);
    console.log(`✅ Updated ${baseName} → ${newName}`);
  }

  // 🆙 Optional: keep the counter channel at top (for text channels only)
  if (displayChannel.type === ChannelType.GuildText) {
    try {
      await displayChannel.setPosition(0);
    } catch (err) {
      console.warn(`⚠️ Couldn't move ${displayChannel.name} to top:`, err.message);
    }
  }
}

// 🔄 Update all categories
async function updateAllCounts(guild) {
  for (const categoryId of Object.keys(CATEGORY_MAP)) {
    await updateCategoryCount(guild, categoryId);
  }
}

// 🟢 When bot starts
client.once("clientReady", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  for (const [, guild] of client.guilds.cache) {
    await updateAllCounts(guild);
  }

  console.log("🔄 Ticket counter is active and listening for changes...");

  // ⏱️ Auto-refresh every 10 minutes
  setInterval(async () => {
    console.log("⏰ Auto-refreshing ticket counters...");
    for (const [, guild] of client.guilds.cache) {
      await updateAllCounts(guild);
    }
  }, 10 * 60 * 1000);
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

// ✏️ Channel renamed (e.g. closed/resolved ticket)
client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (CATEGORY_MAP[oldChannel.parentId]) {
    if (oldChannel.name !== newChannel.name) {
      await updateCategoryCount(newChannel.guild, oldChannel.parentId);
    }
  }
});

client.login(process.env.TOKEN);
