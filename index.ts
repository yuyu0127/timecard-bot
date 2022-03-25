import { Client, Intents, ApplicationCommandDataResolvable, Guild, TextBasedChannel } from 'discord.js';
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
    if (!json.channelTable) {
      json.channelTable = {};
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

client.on('voiceStateUpdate', async (oldState, newState) => {
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;
  const notifyChannel = await fetchNotifyChannel(newState.guild);

  if (!notifyChannel) {
    const guild = oldState.guild || newState.guild;
    const textChannel = guild?.channels.cache.find(x => x.isText());
    if (textChannel && textChannel?.isText()) {
      textChannel.send('通知を有効にするには、はじめに `/set-notify-channel` コマンドで通知先を設定してね');
    }
  }

  // 入室
  if (!oldChannel && newChannel) {
    console.log('connected to ' + newChannel);
    notifyChannel?.send(`${newState.member} が ${newChannel} に入室したよ！`);
  }
  // 退室
  if (oldChannel && !newChannel) {
    console.log('disconnected from ' + oldChannel);
    notifyChannel?.send(`${oldState.member} が ${oldChannel} から退室したよ！`);
  }
  // 移動
  if (oldChannel && newChannel && oldChannel.id != newChannel.id) {
    console.log(`moved from ${oldChannel} to ${newChannel}`);
    notifyChannel?.send(`${newState.member} が ${oldChannel} から ${newChannel} に移動したよ！`);
  }
});

client.login(token);

async function setupCommand(client: Client<true>) {
  await client.application.commands.set(commands);
}

async function fetchNotifyChannel(guild: Guild): Promise<TextBasedChannel | null> {
  let setting: Setting;
  try {
    const data = await fs.readFile(settingFilePath, settingFileEncoding);
    setting = JSON.parse(data);
    const channelId = setting.channelTable[guild.id];
    const channel = client.channels.cache.get(channelId);
    if (channel && channel?.isText()) {
      return channel;
    } else {
      return null;
    }
  } catch {
    return null;
  }
}