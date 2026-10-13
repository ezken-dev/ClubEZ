import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('syncpermissions')
    .setDescription('Synchronize Discord channel & server permissions for all 9 leveling roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '⛔ You need Administrator permissions to synchronize server role permissions.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const report = [];

    // The 9 approved tiers and their bitfield permission configurations
    const tierPerms = [
      {
        name: 'ROOKIE',
        level: 1,
        color: '#00A8FC',
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ],
        deny: [
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.UseExternalEmojis,
          PermissionFlagsBits.UseExternalStickers
        ]
      },
      {
        name: 'INSIDER',
        level: 10,
        color: '#2DD4BF',
        allow: [
          PermissionFlagsBits.AttachFiles
        ]
      },
      {
        name: 'RESIDENT',
        level: 20,
        color: '#38BDF8',
        allow: [
          PermissionFlagsBits.EmbedLinks
        ]
      },
      {
        name: 'CLUB REGULAR',
        level: 30,
        color: '#FBBF24',
        allow: [
          PermissionFlagsBits.UseExternalEmojis,
          PermissionFlagsBits.UseExternalStickers
        ]
      },
      {
        name: 'HYPEMASTER',
        level: 40,
        color: '#F97316',
        allow: [
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.PrioritySpeaker
        ]
      },
      {
        name: 'ASCENDANT',
        level: 55,
        color: '#EF4444',
        allow: [
          PermissionFlagsBits.UseSoundboard,
          PermissionFlagsBits.UseExternalSounds
        ]
      },
      {
        name: 'CLUB TITAN',
        level: 70,
        color: '#E11D48',
        allow: [
          PermissionFlagsBits.UseApplicationCommands
        ]
      },
      {
        name: 'THE IMMORTAL',
        level: 85,
        color: '#FFFFFF',
        allow: [
          PermissionFlagsBits.ChangeNickname
        ]
      },
      {
        name: 'STAR SUPPORTER',
        level: 100,
        color: '#EC4899',
        allow: [
          PermissionFlagsBits.MentionEveryone
        ]
      }
    ];

    try {
      for (const t of tierPerms) {
        let role = guild.roles.cache.find(r =>
          r.name.toLowerCase().replace(/[@\s]/g, '') === t.name.toLowerCase().replace(/[@\s]/g, '')
        );

        if (!role) {
          role = await guild.roles.create({
            name: t.name,
            color: t.color,
            reason: 'Provisioning Club EZKEN progression tier role'
          });
          report.push(`✨ Created **@${t.name}** role`);
        }

        // Compute new permissions bitfield
        let currentBits = role.permissions.bitfield;
        for (const p of t.allow) {
          currentBits |= BigInt(p);
        }
        if (t.deny) {
          for (const d of t.deny) {
            currentBits &= ~BigInt(d);
          }
        }

        await role.setPermissions(currentBits, `Synchronized Level ${t.level} progressive perks`);
        report.push(`🔒 Synchronized **@${t.name}** (Level ${t.level}+)`);
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Role Permissions Synchronized')
        .setColor(CONFIG.COLORS.SUCCESS)
        .setDescription(report.join('\n'))
        .setFooter({ text: 'All 9 Club EZKEN Leveling Roles are now strictly enforced.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[SYNC PERMISSIONS ERROR]', err);
      return interaction.editReply({
        content: `❌ Error synchronizing permissions: ${err.message}`
      });
    }
  }
};
