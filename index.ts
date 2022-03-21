// discord.js モジュールのインポート
import { Client, Intents, ApplicationCommandDataResolvable } from 'discord.js';
import { token } from './config.json';
import { promises as fs } from 'fs';

const settingFilePath = './setting.json';
const settingFileEncoding = 'utf-8';
const commands: ApplicationCommandDataResolvable[] = [
  {
    name: 'set-notify-channel',
    description: '入退室の情報を通知するテキストチャンネルを指定します。',
    type: 'CHAT_INPUT',
    options: [
      {
        type: "CHANNEL",
        name: "チャンネル名",
        description: "通知するテキストチャンネルの名前",
        required: true,
        channelTypes: ["GUILD_TEXT"]
      }
    ]
  }
];

type Setting = {
  channelTable: {
    [guildId: string]: string
  }
};


const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

client.on('ready', (client) => {
  console.log(`logged in as ${client.user.username}`);
  setupCommand(client);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName == "set-notify-channel") {
    let json: Setting;
    try {
      const data = await fs.readFile(settingFilePath, settingFileEncoding);
      json = JSON.parse(data);
    } catch {
      json = { channelTable: {} };
    }

    const key = interaction.guildId;
    const channel = interaction.options.getChannel('チャンネル名');

    if (key && channel) {
      json.channelTable[key] = channel.id;

      const text = JSON.stringify(json);
      await fs.writeFile(settingFilePath, text, settingFileEncoding);

      const reply = `入退室の情報を ${channel} に通知するように設定したよ！`;
      await interaction.reply(reply);
    } else {
      await interaction.reply('通知チャンネルの設定に失敗しました…。');
    }
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.channel && !newState.channel) {
    console.log('disconnected from ' + oldState.channel);
  }
  else if (!oldState.channel && newState.channel) {
    console.log('connected to ' + newState.channel);
  }
  else if (oldState.channel && newState.channel) {
    console.log(`moved from ${oldState.channel} to ${newState.channel}`);
  }
});

client.login(token);

function setupCommand(client: Client<true>) {
  client.guilds.cache.forEach(async (guild) => {
    await client.application.commands.set(commands, guild.id);
  });
}
