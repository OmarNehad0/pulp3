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

/* -------------------- CLIENT -------------------- */

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



const THUMBNAIL_URL =
  "https://images-ext-1.discordapp.net/external/JFwyBBHkv4XzTImBuTamjeJxJB7OmiaEk-YDO5yf5YA/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1091155661183799366/a_7c61dbfa69b37d9cc8f43b93f87f57d7.gif";
const AUTHOR_ICON_URL = THUMBNAIL_URL;
const componentStore = new WeakMap();

function load_json(file_name) {
  try {
    const raw = fs.readFileSync(file_name, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function format_price(price) {
  try {
    price = parseFloat(price);
    if (price === 0) return "$0.00";
    if (price < 1) return `$${price.toFixed(6)}`.replace(/0+$/, "");
    return `$${price.toFixed(2)}`;
  } catch {
    return "N/A $";
  }
}

function is_custom_emoji(value) {
  return /<a?:\w+:\d+>/.test(value);
}

function is_unicode_emoji(value) {
  return value && [...value].some(ch => ch.codePointAt(0) > 10000);
}

function buildSelect(fileName, emoji) {
  const data = load_json(fileName);
  const categoryName = fileName.replace(".json", "").toUpperCase();

  const options = data.map(item => {
    let emojiValue = item.emoji;
    if (emojiValue) {
      emojiValue = String(emojiValue).trim();
      if (!is_unicode_emoji(emojiValue) && !is_custom_emoji(emojiValue)) {
        emojiValue = undefined;
      }
    }

    return {
      label: item.name,
      value: item.name,
      emoji: emojiValue
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(`sapphire_select:${fileName}`)
    .setPlaceholder(`${emoji} | ${categoryName}`)
    .addOptions(options)
    .setMinValues(1)
    .setMaxValues(1);
}

client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: [
      {
        name: "dropdown",
        description: "Open the menu"
      }
    ]
  });
});

client.on("interactionCreate", async (interaction) => {

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "dropdown") {

      // build view
      const view = [];

      JSON_FILES.forEach(file => {
        const emoji = EMOJI_MAP[file] || "🔹";
        const select = buildSelect(file, emoji);
        view.push(new ActionRowBuilder().addComponents(select));
      });

      // buttons
      const ticketBtn = new ButtonBuilder()
        .setLabel("🎫 Open a ticket - Click Here")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.com/channels/1433450572702285966/1433916983505715327");

      const voucherBtn = new ButtonBuilder()
        .setLabel("Our Sythe Vouches")
        .setStyle(ButtonStyle.Link)
        .setURL("https://www.sythe.org/threads/pulp-services-vouch-thread/");

      view.push(new ActionRowBuilder().addComponents(ticketBtn, voucherBtn));

      // ⭐ Send message AND store components
      const msg = await interaction.reply({
        content: "Choose a category:",
        components: view,
        fetchReply: true
      });

      // ⭐ STORE COMPONENTS IN THE MESSAGE (SAPPHIRE STYLE)
      componentStore.set(msg, view);
    }
  }

  if (interaction.isStringSelectMenu()) {

    const fileName = interaction.customId.split(":")[1];
    const selected = interaction.values[0];

    const data = load_json(fileName);
    const item = data.find(i => i.name === selected);

    if (!item) {
      return interaction.reply({ content: "Item not found.", ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(item.name)
      .setDescription(item.caption || "No description provided")
      .setColor("Blue")
      .setThumbnail(item.image || THUMBNAIL_URL)
      .setAuthor({ name: "Pulp Pricing", iconURL: AUTHOR_ICON_URL })
      .setFooter({ text: "Pulp Pricing", iconURL: AUTHOR_ICON_URL });

    if (fileName === "skills.json" && item.methods) {
      embed.addFields({
        name: "Training Methods",
        value: item.methods.map(m => `• **${m.title}**: ${format_price(m.gpxp)} $/XP (Req: ${m.req})`).join("\n")
      });
    } else if (item.items) {
      embed.addFields({
        name: "Available Options",
        value: item.items.map(i => `• **${i.name}**: ${format_price(i.price || 0)}`).join("\n")
      });
    }

    // ⭐ The reset (Sapphire style)
    const stored = componentStore.get(interaction.message);
    await interaction.update({
      components: stored
    });

    // send ephemeral info
    await interaction.followUp({ embeds: [embed], ephemeral: true });
  }
});
client.login(TOKEN);

