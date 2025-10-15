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
  "1427983033343938630": "1427984531822215198", // Example: "130739948475221000": "130739952134908000"
  // Add more if needed:
  // "ANOTHER_CATEGORY_ID": "ANOTHER_COUNTER_CHANNEL_ID"
};

// 🧮 Count active tickets in one category
function countTicketsInCategory(guild, categoryId) {
  return guild.channels.cache.filter(ch =>
    ch.parentId === categoryId &&
    ch.type === ChannelType.GuildText &&
    !ch.name.startsWith("closed") &&
    !ch.name.startsWith("resolved")
  ).size;
}

// 🔁 Update a single category’s counter channel
async function updateCategoryCount(guild, categoryId) {
  const displayChannelId = CATEGORY_MAP[categoryId];
  const displayChannel = guild.channels.cache.get(displayChannelId);
  if (!displayChannel) return;

  const count = countTicketsInCategory(guild, categoryId);
  const newName = `tickets: ${count}`;

  // Avoid renaming if already correct (reduces API calls)
  if (displayChannel.name !== newName) {
    await displayChannel.setName(newName).catch(console.error);
    console.log(`Updated ${displayChannel.name} → ${count} active tickets`);
  }
}

// 🔄 Update all categories
async function updateAllCounts(guild) {
  for (const categoryId of Object.keys(CATEGORY_MAP)) {
    await updateCategoryCount(guild, categoryId);
  }
}

// 🟢 When bot starts up
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  for (const [, guild] of client.guilds.cache) {
    await updateAllCounts(guild);
  }
  console.log("🔄 Ticket counter is active and listening for changes...");
});

// 🧱 Channel created
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
