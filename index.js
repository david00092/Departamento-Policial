const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const express = require("express");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot online"));
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// CONFIGURAÇÕES
const canalEnvioId = "1402769050718699562";
const cargoAprovadorId = "1402768862356836514";
const cargoHavenaId = "1402768579600613386";
const categoriaTicketsId = "1402768953092083813";

const cargoGuarnicoes = {
  Polícia: "1402768867637330091",
  DIP: "1402768868925116517",
  Exército: "1402768870405574827",
  CORE: "1402768871810924574",
  PRN: "1402768872863563927",
  SPF: "1402768874222522519",
};

client.guarnicoesSelecionadas = new Map();

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// Autorole
client.on("guildMemberAdd", async (member) => {
  const cargo = member.guild.roles.cache.get(cargoHavenaId);
  if (cargo) {
    await member.roles.add(cargo).catch(() => null);
  }
});

// Sistema principal
client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId === "formulario_havena") {
      const guarnicaoMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("guarnicao_select")
          .setPlaceholder("Selecione sua guarnição")
          .addOptions(
            Object.keys(cargoGuarnicoes).map((nome) => ({
              label: nome,
              value: nome,
            }))
          )
      );

      await interaction.reply({
        content: "➡️ Escolha sua guarnição antes de preencher o contrato:",
        components: [guarnicaoMenu],
        ephemeral: true,
      });
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "guarnicao_select"
    ) {
      const guarnicaoSelecionada = interaction.values[0];
      client.guarnicoesSelecionadas.set(interaction.user.id, guarnicaoSelecionada);

      const modal = new ModalBuilder()
        .setCustomId("modal_formulario")
        .setTitle("📄 Contrato Aluno - Havena");

      const nome = new TextInputBuilder()
        .setCustomId("nome")
        .setLabel("Nome:")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const passaporte = new TextInputBuilder()
        .setCustomId("passaporte")
        .setLabel("Qual o seu passaporte na cidade?")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const recrutador = new TextInputBuilder()
        .setCustomId("recrutador")
        .setLabel("Recrutador(a):")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(passaporte),
        new ActionRowBuilder().addComponents(recrutador)
      );

      await interaction.showModal(modal);
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId === "modal_formulario"
    ) {
      const nome = interaction.fields.getTextInputValue("nome");
      const passaporte = interaction.fields.getTextInputValue("passaporte");
      const recrutador = interaction.fields.getTextInputValue("recrutador");

      const guarnicao =
        client.guarnicoesSelecionadas.get(interaction.user.id) || "Não definida";

      const embed = new EmbedBuilder()
        .setTitle("📩 Novo Contrato Recebido")
        .setColor("#092666")
        .setThumbnail(interaction.guild.iconURL())
        .addFields(
          { name: "👤 Usuário", value: `<@${interaction.user.id}>`, inline: true },
          { name: "🆔 ID", value: `\`${interaction.user.id}\``, inline: true },
          { name: "📝 Nome", value: `\`${nome}\``, inline: true },
          { name: "🪪 Passaporte", value: `\`${passaporte}\``, inline: true },
          { name: "🎖️ Guarnição", value: `\`${guarnicao}\``, inline: true },
          { name: "🧑‍💼 Recrutador", value: `\`${recrutador}\``, inline: true },
          {
            name: "📅 Data de Envio",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          }
        )
        .setFooter({ text: "Departamento Havena - Aguardando aprovação..." });

      const aprovarBtn = new ButtonBuilder()
        .setCustomId(`aprovar_${interaction.user.id}`)
        .setLabel("✅ Aprovar")
        .setStyle(ButtonStyle.Success);

      const reprovarBtn = new ButtonBuilder()
        .setCustomId(`reprovar_${interaction.user.id}`)
        .setLabel("❌ Reprovar")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(aprovarBtn, reprovarBtn);
      const canal = await client.channels.fetch(canalEnvioId);

      await canal.send({ embeds: [embed], components: [row] });
      await interaction.reply({
        content: "✅ Formulário enviado com sucesso!",
        ephemeral: true,
      });

      client.guarnicoesSelecionadas.delete(interaction.user.id);
      return;
    }

    if (interaction.isButton()) {
      if (!interaction.member.roles.cache.has(cargoAprovadorId)) {
        return interaction.reply({
          content: "❌ Você não tem permissão para executar essa ação.",
          ephemeral: true,
        });
      }

      const customId = interaction.customId;
      if (
        customId.startsWith("aprovar_") ||
        customId.startsWith("reprovar_")
      ) {
        const userId = customId.split("_")[1];
        const membro = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!membro) {
          return interaction.reply({
            content: "❌ Usuário não encontrado.",
            ephemeral: true,
          });
        }

        const embed = interaction.message.embeds[0];
        const nome = embed.fields.find(f => f.name === "📝 Nome")?.value.replace(/`/g, "");
        const guarnicao = embed.fields.find(f => f.name === "🎖️ Guarnição")?.value.replace(/`/g, "");

        if (customId.startsWith("aprovar_")) {
          const cargoGuarnicao = cargoGuarnicoes[guarnicao];
          if (!cargoGuarnicao) {
            return interaction.reply({
              content: "❌ Cargo da guarnição não encontrado.",
              ephemeral: true,
            });
          }

          await membro.roles.add(cargoGuarnicao).catch(() => null);
          await membro.roles.add(cargoHavenaId).catch(() => null);
          await membro.setNickname(`ALN | ${nome}`).catch(() => null);

          const embedAprovado = EmbedBuilder.from(embed)
            .setTitle("✅ Membro Aprovado com Sucesso!")
            .setColor("Green")
            .addFields({
              name: "🧑‍✈️ Recrutador Responsável",
              value: `${interaction.user}`,
            })
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: "Central Polícia • Havena City" })
            .setTimestamp();

          await interaction.update({ embeds: [embedAprovado], components: [] });
          return;
        }

        if (customId.startsWith("reprovar_")) {
          const embedReprovado = EmbedBuilder.from(embed)
            .setTitle("❌ Contrato Reprovado")
            .setColor("Red")
            .addFields({
              name: "🧑‍✈️ Recrutador Responsável",
              value: `${interaction.user}`,
            })
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: "Central Polícia • Havena City" })
            .setTimestamp();

          await interaction.update({ embeds: [embedReprovado], components: [] });

          membro.send(
            `Olá, seu contrato foi reprovado por ${interaction.user.tag}. Caso tenha dúvidas, entre em contato com a equipe.`
          ).catch(() => null);

          return;
        }
      }
    }

    if (interaction.isButton() && interaction.customId === "abrir_ticket") {
      const existingChannel = interaction.guild.channels.cache.find(
        (c) => c.name === `🚔-corregedoria-${interaction.user.username.toLowerCase()}`
      );
      if (existingChannel) {
        await interaction.reply({
          content: `📌 Você já possui um ticket aberto: ${existingChannel}`,
          ephemeral: true,
        });
        return;
      }

      const canal = await interaction.guild.channels.create({
        name: `🚔-corregedoria-${interaction.user.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: categoriaTicketsId,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: cargoAprovadorId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      const botaoFechar = new ButtonBuilder()
        .setCustomId("fechar_ticket")
        .setLabel("🔒 Fechar Ticket")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(botaoFechar);

      const embedTicket = new EmbedBuilder()
        .setTitle("📩 Ticket de Suporte Aberto")
        .setDescription(
          `Olá <@${interaction.user.id}>, sua solicitação foi recebida.\nAguarde um membro da equipe de suporte.`
        )
        .setColor("#092666")
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: "Departamento Havena • Suporte" })
        .setTimestamp();

      await canal.send({
        content: `<@${interaction.user.id}>`,
        embeds: [embedTicket],
        components: [row],
      });

      await interaction.reply({
        content: `✅ Ticket criado: ${canal}`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.isButton() && interaction.customId === "fechar_ticket") {
      await interaction.reply({
        content: "⏳ Fechando o ticket em 5 segundos...",
        ephemeral: true,
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => null);
      }, 5000);
      return;
    }
  } catch (error) {
    console.error("Erro no interactionCreate:", error);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: "❌ Ocorreu um erro.", ephemeral: true });
    } else {
      interaction.reply({ content: "❌ Ocorreu um erro.", ephemeral: true });
    }
  }
});

// Comandos
client.on("messageCreate", async (message) => {
  if (message.content === "!contrato") {
    const botaoContrato = new ButtonBuilder()
      .setCustomId("formulario_havena")
      .setLabel("📄 Preencher Contrato")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(botaoContrato);

    const embed = new EmbedBuilder()
      .setTitle("📋 Sistema de Recrutamento - Departamento Havena")
      .setDescription(
        "🚓 **Foi recrutado em game?**\nClique no botão abaixo para preencher seu contrato.\n\n⚠️ Preencha com atenção! Dados incorretos atrasam sua aprovação."
      )
      .setColor("#092666")
      .setThumbnail(message.guild.iconURL())
      .setFooter({
        text: "Departamento Havena • Sistema de Contrato",
        iconURL: client.user.displayAvatarURL(),
      });

    await message.reply({ embeds: [embed], components: [row] });
  }

  if (message.content === "!ticket") {
    const botaoTicket = new ButtonBuilder()
      .setCustomId("abrir_ticket")
      .setLabel("📨 Abrir Ticket")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(botaoTicket);

    const embed = new EmbedBuilder()
      .setTitle("🎫 Suporte Havena - Ticket")
      .setDescription(
        "Está com alguma dúvida ou problema?\nClique no botão abaixo para abrir um ticket privado com a equipe responsável.\n\n📌 Um atendente responderá o quanto antes."
      )
      .setColor("#092666")
      .setThumbnail(message.guild.iconURL())
      .setFooter({
        text: "Departamento Havena • Atendimento via Ticket",
        iconURL: client.user.displayAvatarURL(),
      });

    await message.reply({ embeds: [embed], components: [row] });
  }
});

client.login(process.env.TOKEN);
