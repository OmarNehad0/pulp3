const { Client, GatewayIntentBits, Partials, Routes, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = "1433919895875092593";

const JSON_FILES = [
  "MegaScales.json",
  "Chambers Of Xeric.json",
  "Theatre Of Blood.json",
  "Tombs Of Amascuts.json",
  "Capes - Quivers.json",
  "Desert Treasure 2 Bosses.json",
  "God Wars Dungeon.json",
  "The Gauntlet.json",
  "Wilderness Bosses.json",
  "Other Bosses.json",
  "Slayer Bosses.json",
  "High-Tier Bosses.json"
];

const EMOJI_MAP = {
  "Chambers Of Xeric.json": "🦄 | ",
  "God Wars Dungeon.json": "🦅 | ",
  "Desert Treasure 2 Bosses.json": "🐲 | ",
  "The Gauntlet.json": "🐷 | ",
  "Capes - Quivers.json": "👹 | ",
  "Theatre Of Blood.json": "🕸 | ",
  "Wilderness Bosses.json": "🦞 | ",
  "Tombs Of Amascuts.json": "🐫 | ",
  "Other Bosses.json": "🦍 | ",
  "Slayer Bosses.json": "🦍 | ",
  "MegaScales.json": "🦄 | ",
  "High-Tier Bosses.json": "🏹 | "
};

let discountPercent = 0;

const ALLOWED_ROLE_IDS = new Set([
  "1433480285688692856",
  "1433451021736087743",
  "1434344428767809537",
  "1433848962166685778"
]);

function loadBosses(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function hasAllowedRole(member) {
  return member.roles.cache.some(r => ALLOWED_ROLE_IDS.has(r.id));
}

async function logInteraction(user, bossName, jsonFile, killCount) {
  const channel = await client.channels.fetch(LOG_CHANNEL_ID);
  const bosses = loadBosses(jsonFile);
  const boss = bosses.find(b => b.name === bossName);

  const embed = new EmbedBuilder()
    .setTitle("🧾 Boss Calculation Log")
    .setColor("Blue")
    .addFields(
      { name: "👤 User", value: `${user.tag} (${user.id})`, inline: false },
      { name: "🐲 Boss", value: bossName, inline: false },
      { name: "📂 Category", value: jsonFile.replace(".json", ""), inline: false },
      { name: "⚔️ Kill Count", value: killCount.toString(), inline: false }
    )
    .setTimestamp();

  if (boss && boss.image) embed.setThumbnail(boss.image);
  await channel.send({ embeds: [embed] });
}

function buildRowsForFiles(files) {
  const rows = [];

  files.forEach(file => {
    const bosses = loadBosses(file);
    if (!bosses.length) return;

    const options = bosses.map(b => ({
      label: b.name,
      value: `${file}|${b.name}`,
      description: `Boss ${b.name}`,
      emoji: b.emoji || "🔨"
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`boss_select:${file}`)
      .setPlaceholder(`${EMOJI_MAP[file] || "🔨"}${file.replace(".json", "")}`)
      .addOptions(options);

    rows.push(new ActionRowBuilder().addComponents(menu));
  });

  return rows;
}

// --- SEND MENUS FUNCTION ---
async function sendMenus(interactionOrChannel, isInteraction = true) {
  const allRows = buildRowsForFiles(JSON_FILES);
  const chunks = [];

  for (let i = 0; i < allRows.length; i += 5) {
    chunks.push(allRows.slice(i, i + 5));
  }

  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      if (isInteraction) {
        await interactionOrChannel.reply({
          content: "Choose a boss:",
          components: chunks[i],
          ephemeral: true
        });
      } else {
        await interactionOrChannel.send({
          content: "Choose a boss:",
          components: chunks[i]
        });
      }
    } else {
      await interactionOrChannel.followUp({
        content: "Choose a boss:",
        components: chunks[i],
        ephemeral: true
      });
    }
  }
}

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    {
      name: "pvm_discount",
      description: "Set a discount percentage for all bosses",
      options: [
        {
          name: "percent",
          description: "Discount percentage (e.g., 20)",
          type: 4,
          required: true
        }
      ]
    },
    {
      name: "start",
      description: "Start the boss selector"
    }
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
});

client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "pvm_discount") {
      discountPercent = interaction.options.getInteger("percent");
      await interaction.reply({ content: `✅ Discount set to **${discountPercent}%**`, ephemeral: true });
    }

    if (interaction.commandName === "start") {

      if (!hasAllowedRole(interaction.member)) {
        return interaction.reply({ content: "❌ You don’t have permission.", ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      await interaction.deleteReply();
      await sendMenus(interaction, true);
    }
  }

  if (interaction.isStringSelectMenu()) {
    const [jsonFile, bossName] = interaction.values[0].split("|");

    const modal = new ModalBuilder()
      .setCustomId(`killcount_modal:${jsonFile}|${bossName}`)
      .setTitle("Kill Count Form");

    const killInput = new TextInputBuilder()
      .setCustomId("kill_count")
      .setLabel("Enter the number of kills")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(killInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    const [jsonFile, bossName] = interaction.customId.split(":")[1].split("|");
    const killCount = parseInt(interaction.fields.getTextInputValue("kill_count"));

    const bosses = loadBosses(jsonFile);
    const boss = bosses.find(b => b.name === bossName);

    if (!boss) return interaction.reply({ content: "Boss not found.", ephemeral: true });

    await logInteraction(interaction.user, bossName, jsonFile, killCount);

    const embed = new EmbedBuilder()
      .setTitle(`**${boss.name}**`)
      .setDescription(boss.caption || "No description available.")
      .setColor(0x8B0000);

    if (discountPercent > 0) {
      embed.addFields({ name: "Applied Discount", value: `${discountPercent}%`, inline: false });
    }

    boss.items.forEach(item => {
      const price = item.price * killCount;
      const discounted = price * (1 - discountPercent / 100);

      let value = `**${killCount} KC**\n`;
      value += discountPercent > 0
        ? `💵 Original: $${price.toFixed(2)}\n💵 After Discount: $${discounted.toFixed(2)}`
        : `💵 Total: $${price.toFixed(2)}`;

      embed.addFields({
        name: `${item.emoji || "🔨"} ${item.name}`,
        value: value,
        inline: false
      });
    });

    if (boss.items[0]?.image) {
      embed.setThumbnail(boss.items[0].image);
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // 🔥 SEND NEW MENUS (RESET)
    await sendMenus(interaction, true);
  }
});

client.login(TOKEN);


