require("dotenv").config();
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// 🧩 CATEGORY MAP
// Format: "CategoryID": "CounterChannelID"
// ⚠️ These IDs must belong to THE SAME GUILD the bot is running in
const CATEGORY_MAP = {
  "1330176823157587988": "1430160855982673930", // T1
  "1397564599653371945": "1430160780463968277", // T2
  "1378660136813596772": "1430160626411507773", // T3
  "1402961050927763618": "1430160519750225920", // T4
  "1402961328209006672": "1430155833127469227", // REALISTIC
  "1437901501157871780": "1441403795379589150", // Cup
};

// 🎫 Decide if a channel is actually a ticket channel
function isTicketChannel(channel) {
  if (channel.type !== ChannelType.GuildText) return false;

  const name = channel.name.toLowerCase();

  // 👉 EDIT THIS to match your actual ticket naming scheme
  // Examples:
  //   ticket-001
  //   t1-ticket-01
  //   cup-001
  if (
    name.startsWith("ticket-") || // generic tickets
    name.startsWith("cup-")       // cup tickets (if you use this)
  ) {
    return true;
  }

  return false;
}

// 🧮 Count active tickets (ignore closed + counter channel)
function countTicketsInCategory(guild, categoryId) {
  const displayChannelId = CATEGORY_MAP[categoryId];

  return guild.channels.cache.filter(ch =>
    ch.parentId === categoryId &&
    ch.type === ChannelType.GuildText &&
    ch.id !== displayChannelId && // ignore counter channel itself
    isTicketChannel(ch) &&        // ✅ only ticket channels
    !ch.name.toLowerCase().startsWith("closed") &&
    !ch.name.toLowerCase().startsWith("resolved")
  ).size;
}

// 🔁 Update a single category’s counter
async function updateCategoryCount(guild, categoryId) {
  const displayChannelId = CATEGORY_MAP[categoryId];

  // Only use cached channels; avoids cross-guild fetch errors
  const displayChannel = guild.channels.cache.get(displayChannelId);
  const category = guild.channels.cache.get(categoryId);

  if (!displayChannel || !category) {
    // Silently ignore if this guild doesn't have that category/counter
    return;
  }

  const count = countTicketsInCategory(guild, categoryId);

  // 🏷️ Preserve your current prefix (everything before ":")
  const currentName = displayChannel.name;
  const baseName = currentName.includes(":")
    ? currentName.split(":")[0].trim()
    : currentName.trim();

  const newName = `${baseName}: ${count}`;

  // ✅ Only rename if the count changed
  if (currentName !== newName) {
    try {
      await displayChannel.setName(newName);
      console.log(`✅ Updated ${baseName} → ${newName}`);
    } catch (err) {
      console.error(`⚠️ Failed to rename ${displayChannelId}:`, err.message);
    }
  }

  // 🆙 Optional: keep the counter channel at the top of the category
  if (displayChannel.type === ChannelType.GuildText) {
    try {
      await displayChannel.setPosition(0);
    } catch (err) {
      console.warn(`⚠️ Couldn't move ${displayChannel.name} to top:`, err.message);
    }
  }
}

// 🔄 Update all categories for this guild
async function updateAllCounts(guild) {
  for (const categoryId of Object.keys(CATEGORY_MAP)) {
    // 👇 Only try to update categories that actually exist in this guild
    if (!guild.channels.cache.has(categoryId)) continue;
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
  if (!channel.guild) return;

  const parentId = channel.parentId;
  if (!parentId) return;

  if (CATEGORY_MAP[parentId]) {
    await updateCategoryCount(channel.guild, parentId);
  }
});

// 🗑️ Channel deleted
client.on("channelDelete", async channel => {
  if (!channel.guild) return;

  const parentId = channel.parentId;
  if (!parentId) return;

  if (CATEGORY_MAP[parentId]) {
    await updateCategoryCount(channel.guild, parentId);
  }
});

// ✏️ Channel renamed (e.g. closed/resolved ticket)
client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (!newChannel.guild) return;

  const parentId = oldChannel.parentId || newChannel.parentId;
  if (!parentId) return;

  if (CATEGORY_MAP[parentId] && oldChannel.name !== newChannel.name) {
    await updateCategoryCount(newChannel.guild, parentId);
  }
});

client.login(process.env.TOKEN);
