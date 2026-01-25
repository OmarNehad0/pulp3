const {Client,GatewayIntentBits,Partials,Routes,ActionRowBuilder,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,EmbedBuilder,} = require("discord.js");
const { REST } = require("@discordjs/rest");
const fs = require("fs");
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = "1433919895875092593";

/* -------------------- CONFIG -------------------- */

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

/* -------------------- HELPERS -------------------- */

function loadBosses(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return [];
  }
}

function buildMenus() {
  return JSON_FILES.map((file) => {
    const bosses = loadBosses(file);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`boss_select:${file}`)
      .setPlaceholder(`${EMOJI_MAP[file]}${file.replace(".json", "")}`)
      .addOptions(
        bosses.map((b) => ({
          label: b.name,
          value: `${file}|${b.name}`,
          emoji: b.emoji || "⚔️",
        }))
      );

    return new ActionRowBuilder().addComponents(menu);
  });
}

async function logInteraction(user, bossName, jsonFile, kc) {
  const channel = await client.channels.fetch(LOG_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("🧾 Boss Calculation Log")
    .setColor("Blue")
    .addFields(
      { name: "User", value: `${user.tag}` },
      { name: "Boss", value: bossName },
      { name: "Category", value: jsonFile.replace(".json", "") },
      { name: "Kill Count", value: kc.toString() }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

/* -------------------- READY -------------------- */

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const commands = [
    {
      name: "start",
      description: "Open PvM selector",
    },
    {
      name: "pvm_discount",
      description: "Set discount %",
      options: [
        {
          name: "percent",
          type: 4,
          required: true,
          description: "Discount percent",
        },
      ],
    },
  ];

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
});

/* -------------------- INTERACTIONS -------------------- */

client.on("interactionCreate", async (interaction) => {
  /* ---------- SLASH ---------- */

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "pvm_discount") {
      discountPercent = interaction.options.getInteger("percent");
      return interaction.reply({
        content: `✅ Discount set to **${discountPercent}%**`,
        flags: 64,
      });
    }

    if (interaction.commandName === "start") {
      return interaction.reply({
        content: "Choose a boss:",
        components: buildMenus(),
        flags: 64,
      });
    }
  }

  /* ---------- SELECT MENU ---------- */

  if (interaction.isStringSelectMenu()) {
    const [jsonFile, bossName] = interaction.values[0].split("|");

    // 🔹 Confirmation
    await interaction.reply({
      content: `✅ Selected **${bossName}**`,
      flags: 64,
    });

    // 🔹 Fresh dropdown (reset placeholder)
    await interaction.followUp({
      content: "Choose another boss:",
      components: buildMenus(),
      flags: 64,
    });

    // 🔹 Modal
    const modal = new ModalBuilder()
      .setCustomId(`killcount:${jsonFile}|${bossName}`)
      .setTitle("Kill Count");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kc")
          .setLabel("Enter kill count")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    return interaction.showModal(modal);
  }

  /* ---------- MODAL ---------- */

  if (interaction.isModalSubmit()) {
    const [jsonFile, bossName] = interaction.customId
      .replace("killcount:", "")
      .split("|");

    const kc = parseInt(interaction.fields.getTextInputValue("kc"));
    const boss = loadBosses(jsonFile).find((b) => b.name === bossName);
    if (!boss) {
      return interaction.reply({ content: "Boss not found.", flags: 64 });
    }

    await logInteraction(interaction.user, bossName, jsonFile, kc);

    const embed = new EmbedBuilder()
      .setTitle(boss.name)
      .setColor("DarkRed")
      .setDescription(boss.caption || "—");

    boss.items.forEach((item) => {
      const base = item.price * kc;
      const final =
        discountPercent > 0
          ? base * (1 - discountPercent / 100)
          : base;

      embed.addFields({
        name: `${item.emoji || "⚔️"} ${item.name}`,
        value: `KC: ${kc}\n💰 ${final.toFixed(2)}`,
      });
    });

    return interaction.reply({
      embeds: [embed],
      flags: 64,
    });
  }
});
client.login(TOKEN);

