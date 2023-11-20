import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import https from 'https'
import internal from "stream";
import { AuthResponseType } from "./types";
import { randomUUID } from "crypto";

export function initBot() {
  const token = process.env.BOT_TOKEN;

  if (token) {
    const bot = new TelegramBot(token, { polling: true });
    handleBotMessages(bot);
  } else {
    throw new Error("bot token not found");
  }
}

function handleBotMessages(bot: TelegramBot) {
  bot.on('voice', async (msg) => {
    const chatId = msg.chat.id
    const voice = msg.voice;
    if (!voice) return
    const fileId = voice.file_id;
    const file = bot.getFileStream(fileId);
    const newMsg =  await transcribeAudio(file);
    if (newMsg && newMsg.length) {
      bot.sendMessage(chatId, newMsg, {
        reply_to_message_id: msg.message_id,
      });
    } else {
      bot.sendMessage(chatId, "Can't transcribe audio, check your microphone", {
        reply_to_message_id: msg.message_id,
      });
    }
  })
}

async function transcribeAudio(file: internal.Readable): Promise<string> {
  const transcribeUrl = "https://smartspeech.sber.ru/rest/v1/speech:recognize";
  const token = await getAccessToken();
  if (!token) throw new Error("token not found");
  try {
    const res = await axios.post(transcribeUrl, file, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "audio/ogg;codecs=opus",
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    return res.data.result[0];
  } catch (err) {
    return Promise.reject(err);
  }
}

const getAccessToken = async () => {
  const authData = process.env.SALUTE_SPEECH_AUTHDATA;
  const scope = process.env.SALUTE_SPEECH_SCOPE;
  const hasSaluteData = authData && scope;
  const guid = randomUUID()
  const authUrl = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";

  if (!hasSaluteData) {
    throw new Error("no data for access token");
  }
  const params = new URLSearchParams();

  params.append("scope", scope);
  try {
    const res = await axios.post<AuthResponseType>(authUrl, params, {
      headers: {
        Authorization: `Bearer ${authData}`,
        RqUID: guid,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    },);
    return res.data.access_token;
  } catch (err) {
    return Promise.reject(err);
  }
};
