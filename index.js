// pvm-boss-calculator-stateless.js
const {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

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
  "High-Tier Bosses.json",
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
  "High-Tier Bosses.json": "🏹 | ",
};

let discountPercent = 0;

// ===== HELPERS =====
function loadBosses(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch {
    return [];
  }
}

function buildBaseEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({
      name: process.env.BOT_NAME || "PVM Calculator",
      iconURL: process.env.BOT_AVATAR || null,
      url: process.env.BOT_DISCORD_INVITE || null,
    })
    .setThumbnail(process.env.BOT_AVATAR || null)
    .setTitle(title)
    .setDescription(description || "")
    .setTimestamp()
    .setFooter({ text: "PVM Calculator System" });
}

// ===== REGISTER SLASH COMMANDS =====
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [
      { name: "start", description: "Start the PVM Boss selector" },
      {
        name: "pvm_discount",
        description: "Set discount for bosses",
        options: [
          {
            name: "percent",
            description: "Discount percentage (1-100)",
            type: 4,
            required: true,
          },
        ],
      },
    ],
  });
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  // ===== /start =====
  if (interaction.isChatInputCommand() && interaction.commandName === "start") {
    const embed = buildBaseEmbed("⚔️ PVM Boss Calculator", "Select a category below.");
    const categoryMenu = new StringSelectMenuBuilder()
      .setCustomId("category_select")
      .setPlaceholder("Choose a Category")
      .addOptions(
        JSON_FILES.map((file) => ({
          label: file.replace(".json", ""),
          value: file,
          emoji: EMOJI_MAP[file]?.split(" | ")[0] || "📁",
        }))
      );

    const row = new ActionRowBuilder().addComponents(categoryMenu);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  }

  // ===== /pvm_discount =====
  if (interaction.isChatInputCommand() && interaction.commandName === "pvm_discount") {
    discountPercent = interaction.options.getInteger("percent");
    return interaction.reply({ content: `✅ Discount set to ${discountPercent}%`, ephemeral: true });
  }

  // ===== Category Select =====
  if (interaction.isStringSelectMenu() && interaction.customId === "category_select") {
    const jsonFile = interaction.values[0];
    const bosses = loadBosses(jsonFile);
    if (!bosses.length) return interaction.reply({ content: "❌ No bosses found.", ephemeral: true });

    const embed = buildBaseEmbed(`📂 ${jsonFile.replace(".json", "")}`, "Select a boss below.");
    const bossMenu = new StringSelectMenuBuilder()
      .setCustomId(`boss_select:${jsonFile}`)
      .setPlaceholder("Choose a Boss")
      .addOptions(
        bosses.map((b) => ({
          label: b.name,
          value: `${jsonFile}|${b.name}`,
          emoji: b.emoji || "🔨",
        }))
      );

    const row = new ActionRowBuilder().addComponents(bossMenu);
    await interaction.update({ embeds: [embed], components: [row] });
  }

  // ===== Boss Select =====
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("boss_select:")) {
    const [jsonFile, bossName] = interaction.values[0].split("|");

    // فقط لتحديث المكون بدون حفظ أي بيانات
    await interaction.update({ components: interaction.message.components });

    const modal = new ModalBuilder()
      .setCustomId(`killcount_modal:${jsonFile}|${bossName}`)
      .setTitle("Kill Count")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("kill_count")
            .setLabel("Enter Number of Kills")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }

  // ===== Modal Submit =====
  if (interaction.isModalSubmit() && interaction.customId.startsWith("killcount_modal:")) {
    await interaction.deferReply({ ephemeral: true });

    const [jsonFile, bossName] = interaction.customId.split(":")[1].split("|");
    const killCount = Number(interaction.fields.getTextInputValue("kill_count"));
    const boss = loadBosses(jsonFile).find((b) => b.name === bossName);
    if (!boss) return interaction.editReply({ content: "❌ Boss not found." });

    const embed = buildBaseEmbed(`🐲 ${boss.name}`, `Kill Count: **${killCount}**`);
    boss.items.forEach((item) => {
      const total = item.price * killCount;
      const final = total * (1 - discountPercent / 100);
      embed.addFields({
        name: `${item.emoji || "🔨"} ${item.name}`,
        value: discountPercent ? `~~$${total.toFixed(2)}~~ → **$${final.toFixed(2)}**` : `$${total.toFixed(2)}`,
        inline: true,
      });
    });

    // الرد مباشرة، بدون حفظ أي شيء
    await interaction.editReply({ embeds: [embed] });
  }
});

// ===== LOGIN =====
client.login(TOKEN);
