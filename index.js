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
  EmbedBuilder
} = require("discord.js");
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
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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
    return JSON.parse(fs.readFileSync(filePath));
  } catch {
    return [];
  }
}

function hasAllowedRole(member) {
  return member.roles.cache.some(r => ALLOWED_ROLE_IDS.has(r.id));
}

function buildRowsForFiles(files) {
  const rows = [];

  files.forEach(file => {
    const bosses = loadBosses(file);
    if (!bosses.length) return;

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`boss_select:${file}`)
      .setPlaceholder(`${EMOJI_MAP[file] || ""}${file.replace(".json", "")}`)
      .addOptions(
        bosses.map(b => ({
          label: b.name,
          value: `${file}|${b.name}`,
          emoji: b.emoji || "🔨"
        }))
      );

    rows.push(new ActionRowBuilder().addComponents(menu));
  });

  return rows;
}

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
        .setTimestamp()
    ]
  });
}

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    {
      body: [
        {
          name: "pvm_discount",
          description: "Set a discount percentage",
          options: [
            {
              name: "percent",
              description: "Discount percentage (1–100)",
              type: 4,
              required: true
            }
          ]
        },
        {
          name: "start",
          description: "Start the boss selector"
        }
      ]
    }
  );
});

client.on("interactionCreate", async interaction => {

  // ===== /start =====
  if (interaction.isChatInputCommand() && interaction.commandName === "start") {
    if (!hasAllowedRole(interaction.member)) {
      return interaction.reply({ content: "❌ No permission.", flags: 64 });
    }

    const rows = buildRowsForFiles(JSON_FILES);
    const chunks = chunkArray(rows, 5);

    // first message must be reply
    await interaction.reply({
      components: chunks[0],
      ephemeral: false
    });

    // remaining menus = followUps
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        components: chunks[i],
        ephemeral: false
      });
    }
  }

  // ===== Discount =====
  if (interaction.isChatInputCommand() && interaction.commandName === "pvm_discount") {
    discountPercent = interaction.options.getInteger("percent");
    return interaction.reply({ content: `✅ Discount set to ${discountPercent}%`, flags: 64 });
  }

  // ===== Select Menu =====
  if (interaction.isStringSelectMenu()) {
    const [jsonFile, bossName] = interaction.values[0].split("|");

    const modal = new ModalBuilder()
      .setCustomId(`killcount_modal:${jsonFile}|${bossName}`)
      .setTitle("Kill Count");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("kill_count")
          .setLabel("Number of kills")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    // 🔥 THIS resets the placeholder
    await interaction.update({
      components: interaction.message.components
    });

    await interaction.showModal(modal);
  }

  // ===== Modal Submit =====
  // ===== Modal Submit =====
  if (interaction.isModalSubmit()) {
    const [jsonFile, bossName] = interaction.customId.split(":")[1].split("|");
    const killCount = Number(interaction.fields.getTextInputValue("kill_count"));

    const boss = loadBosses(jsonFile).find(b => b.name === bossName);
    if (!boss) return;

    await logInteraction(interaction.user, bossName, jsonFile, killCount);

    const embed = new EmbedBuilder()
      .setTitle(boss.name)
      .setColor(0x8B0000);

    boss.items.forEach(item => {
      const total = item.price * killCount;
      const final = total * (1 - discountPercent / 100);

      embed.addFields({
        name: `${item.emoji || "🔨"} ${item.name}`,
        value: discountPercent
          ? `~~$${total.toFixed(2)}~~ → **$${final.toFixed(2)}**`
          : `$${total.toFixed(2)}`
      });
    });

    // 👇 followUp instead of reply
    await interaction.followUp({
      embeds: [embed],
      ephemeral: true
    });
  }
});

client.login(TOKEN);





