require("dotenv").config();
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// 🧩 CATEGORY MAP
// categoryId : displayChannelId
const CATEGORY_MAP = {
  "123456789012345678": "234567890123456789", // Support Tickets
  "345678901234567890": "456789012345678901", // Bug Reports
  "567890123456789012": "678901234567890123", // Suggestions
};

// 🧮 Count active (non-closed) ticket channels in a category
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

  // Only rename if it actually changed (avoid rate limits)
  if (displayChannel.name !== newName) {
    await displayChannel.setName(newName).catch(console.error);
    console.log(`Updated ${displayChannel.name} → ${count} active tickets`);
  }
}

// 🔄 Update all categories at once
async function updateAllCounts(guild) {
  for (const categoryId of Object.keys(CATEGORY_MAP)) {
    await updateCategoryCount(guild, categoryId);
  }
}

// 🟢 Bot ready
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  for (const [, guild] of client.guilds.cache) {
    await updateAllCounts(guild);
  }
});

// 📥 When a channel is created
client.on("channelCreate", async channel => {
  if (CATEGORY_MAP[channel.parentId]) {
    await updateCategoryCount(channel.guild, channel.parentId);
  }
});

// 🗑️ When a channel is deleted
client.on("channelDelete", async channel => {
  if (CATEGORY_MAP[channel.parentId]) {
    await updateCategoryCount(channel.guild, channel.parentId);
  }
});

// 📝 When a ticket is renamed (e.g., active → closed)
client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (CATEGORY_MAP[oldChannel.parentId]) {
    // If name changed and it’s a ticket channel, refresh
    if (oldChannel.name !== newChannel.name) {
      await updateCategoryCount(newChannel.guild, oldChannel.parentId);
    }
  }
});

client.login(process.env.TOKEN);
