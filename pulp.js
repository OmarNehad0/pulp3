const { Client, GatewayIntentBits, Partials, Routes, ActionRowBuilder, SelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
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

function formatPrice(price) {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(1)}m`;
  if (price >= 1_000) return `${(price / 1_000).toFixed(1)}k`;
  return price.toString();
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

      await interaction.reply("https://i.postimg.cc/HW8Rh9t2/Header.gif");

      const ticketLink = "https://discord.com/channels/1433450572702285966/1433916983505715327";
      const voucherLink = "https://www.sythe.org/threads/pulp-services-vouch-thread/";

      const chunkSize = 3;
      for (let i = 0; i < JSON_FILES.length; i += chunkSize) {
        const chunk = JSON_FILES.slice(i, i + chunkSize);

        const row = new ActionRowBuilder();
        chunk.forEach(file => {
          const bosses = loadBosses(file);
          if (!bosses.length) return;

          const options = bosses.map(boss => ({
            label: boss.name,
            value: `${file}|${boss.name}`,
            description: `Boss ${boss.name}`,
            emoji: boss.emoji || "🔨"
          }));

          const menu = new SelectMenuBuilder()
            .setCustomId(`boss_select:${file}`)
            .setPlaceholder(`${EMOJI_MAP[file] || "🔨"}${file.replace(".json", "")}`)
            .addOptions(options);

          row.addComponents(menu);
        });

        await interaction.followUp({ components: [row] });
      }

      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("🎟️ Open a ticket - Click Here")
            .setStyle(ButtonStyle.Link)
            .setURL(ticketLink),
          new ButtonBuilder()
            .setLabel("Our Sythe Vouches")
            .setStyle(ButtonStyle.Link)
            .setURL(voucherLink)
        );

      await interaction.followUp({ components: [buttonRow] });
    }
  }

  if (interaction.isSelectMenu()) {
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

    // ✅ RESET dropdowns (like your JS snippet)
    const message = interaction.message;
    if (message) {
      const newComponents = message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components = newRow.components.map(comp => {
          if (comp.customId && comp.customId.startsWith("boss_select:")) {
            const file = comp.customId.split(":")[1];
            const bosses = loadBosses(file);

            return new SelectMenuBuilder()
              .setCustomId(comp.customId)
              .setPlaceholder(`${EMOJI_MAP[file] || "🔨"}${file.replace(".json", "")}`)
              .addOptions(bosses.map(b => ({
                label: b.name,
                value: `${file}|${b.name}`,
                description: `Boss ${b.name}`,
                emoji: b.emoji || "🔨"
              })));
          }
          return comp;
        });
        return newRow;
      });

      await interaction.update({ components: newComponents });
    }
  }
});
client.login(TOKEN);
