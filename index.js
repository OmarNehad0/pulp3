// pvm-boss-calculator.js
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
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");
const Pagination = require("customizable-discordjs-pagination");
const _ = require("lodash-contrib");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

// ===== CONFIG =====
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
const ALLOWED_ROLE_IDS = new Set([
  "1433480285688692856",
  "1433451021736087743",
  "1434344428767809537",
  "1433848962166685778",
]);

// ===== HELPERS =====
function loadBosses(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch {
    return [];
  }
}

function hasAllowedRole(member) {
  return member.roles.cache.some((r) => ALLOWED_ROLE_IDS.has(r.id));
}

// ===== LOGGING =====
async function logInteraction(user, bossName, jsonFile, killCount) {
  const channel = await client.channels.fetch(LOG_CHANNEL_ID);
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🧾 Boss Calculation Log")
        .setColor("Blue")
        .addFields(
          { name: "👤 User", value: `${user.tag} (${user.id})` },
          { name: "🐲 Boss", value: bossName },
          { name: "📂 Category", value: jsonFile.replace(".json", "") },
          { name: "⚔️ Kill Count", value: killCount.toString() }
        )
        .setTimestamp(),
    ],
  });
}

// ===== RESPONSE CLASS (clone of BotResponse) =====
class PVMResponse {
  constructor(interaction) {
    this.response = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setAuthor({
        name: process.env.BOT_NAME || "PVM Calculator",
        iconURL: process.env.BOT_AVATAR || null,
        url: process.env.BOT_DISCORD_INVITE || null,
      })
      .setThumbnail(process.env.BOT_AVATAR || null)
      .setTimestamp();
    this.components = [];
    this.interaction = interaction;
  }

  setTitle(title) {
    this.response.setTitle(title);
    return this;
  }

  setDescription(description) {
    this.response.setDescription(description);
    return this;
  }

  addField(name, value, inline = true) {
    this.response.addFields({ name, value, inline });
    return this;
  }

  addFields(fields) {
    this.response.addFields(fields);
    return this;
  }

  setComponent(component) {
    this.components.push(component);
    return this;
  }

  async reply(ephemeral = true) {
    const send = this.components.length
      ? { embeds: [this.response], components: this.components, flags: ephemeral ? 64 : undefined }
      : { embeds: [this.response], flags: ephemeral ? 64 : undefined };
    await this.interaction.reply(send);
  }

  async followUp() {
    const send = this.components.length
      ? { embeds: [this.response], components: this.components, flags: 64 }
      : { embeds: [this.response], flags: 64 };
    await this.interaction.followUp(send);
  }
}

// ===== SLASH COMMAND REGISTRATION =====
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
          { name: "percent", description: "Discount percentage", type: 4, required: true },
        ],
      },
    ],
  });
});

// ===== INTERACTIONS =====
client.on("interactionCreate", async (interaction) => {
  // ===== /start =====
  if (interaction.isChatInputCommand() && interaction.commandName === "start") {
    if (!hasAllowedRole(interaction.member)) {
      return new PVMResponse(interaction).setDescription("❌ No permission.").reply();
    }

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

    await new PVMResponse(interaction)
      .setTitle("⚔️ PVM Boss Calculator")
      .setDescription("Select a category below.")
      .setComponent(row)
      .reply(false);
  }

  // ===== /pvm_discount =====
  if (interaction.isChatInputCommand() && interaction.commandName === "pvm_discount") {
    discountPercent = interaction.options.getInteger("percent");
    return new PVMResponse(interaction)
      .setDescription(`✅ Discount set to ${discountPercent}%`)
      .reply();
  }

  // ===== Category Select =====
  if (interaction.isStringSelectMenu() && interaction.customId === "category_select") {
    const jsonFile = interaction.values[0];
    const bosses = loadBosses(jsonFile);
    if (!bosses.length)
      return new PVMResponse(interaction).setDescription("❌ No bosses found.").reply();

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

    await new PVMResponse(interaction)
      .setTitle(`📂 ${jsonFile.replace(".json", "")}`)
      .setDescription("Select a boss below.")
      .setComponent(row)
      .reply(false);
  }

  // ===== Boss Select =====
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("boss_select:")) {
    const [jsonFile, bossName] = interaction.values[0].split("|");
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
    await interaction.deferReply({ flags: 64 });

    const [jsonFile, bossName] = interaction.customId.split(":")[1].split("|");
    const killCount = Number(interaction.fields.getTextInputValue("kill_count"));
    const boss = loadBosses(jsonFile).find((b) => b.name === bossName);
    if (!boss)
      return new PVMResponse(interaction).setDescription("❌ Boss not found.").reply();

    await logInteraction(interaction.user, bossName, jsonFile, killCount);

    const response = new PVMResponse(interaction)
      .setTitle(`🐲 ${boss.name}`)
      .setDescription(`Kill Count: **${killCount}**`);

    boss.items.forEach((item) => {
      const total = item.price * killCount;
      const final = total * (1 - discountPercent / 100);
      response.addField(
        `${item.emoji || "🔨"} ${item.name}`,
        discountPercent ? `~~$${total.toFixed(2)}~~ → **$${final.toFixed(2)}**` : `$${total.toFixed(2)}`
      );
    });

    await response.reply();
  }
});

// ===== LOGIN =====
client.login(TOKEN);

