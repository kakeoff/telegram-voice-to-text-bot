import axios from "axios";
import axiosRetry from "axios-retry";
import { randomUUID } from "crypto";
import https from "https";
import TelegramBot, { Message } from "node-telegram-bot-api";
import internal from "stream";
import { AuthResponseType } from "./types";

axiosRetry(axios, { retries: 3 });

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export function initBot() {
  const token = process.env.BOT_TOKEN;

  if (token) {
    const bot = new TelegramBot(token, { polling: true });
    handleBotMessages(bot);
  } else {
    console.error("BOT_TOKEN not found");
  }
}

function handleBotMessages(bot: TelegramBot) {
  bot.on("voice", async (msg: Message) => {
    const chatId = msg.chat.id;
    const voice = msg.voice;
    if (!voice) return;

    const fileId = voice.file_id;
    const file = bot.getFileStream(fileId);

    try {
      const newMsg = await transcribeAudio(file);
      if (newMsg && newMsg.length) {
        bot.sendMessage(chatId, newMsg, {
          reply_to_message_id: msg.message_id,
        });
      } else {
        bot.sendMessage(
          chatId,
          "Can't transcribe audio, check your microphone",
          {
            reply_to_message_id: msg.message_id,
          }
        );
      }
    } catch (err) {
      console.error("Error while transcribing audio:", err);
      bot.sendMessage(chatId, "Error occurred during transcription", {
        reply_to_message_id: msg.message_id,
      });
    }
  });
}

async function transcribeAudio(file: internal.Readable): Promise<string> {
  const transcribeUrl = "https://smartspeech.sber.ru/rest/v1/speech:recognize";
  const token = await getAccessToken();
  if (!token) throw new Error("Token not found");

  try {
    const res = await axios.post(transcribeUrl, file, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "audio/ogg;codecs=opus",
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    if (res.data && res.data.result && res.data.result.length > 0) {
      return res.data.result[0];
    } else {
      throw new Error("Invalid response from transcription service");
    }
  } catch (err) {
    console.error("Error during transcription:", err);
    return Promise.reject("Transcription service error");
  }
}

const getAccessToken = async (): Promise<string | null> => {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const authData = process.env.SALUTE_SPEECH_AUTHDATA;
  const scope = process.env.SALUTE_SPEECH_SCOPE;
  const guid = randomUUID();

  if (!authData) {
    throw new Error("Auth data is missing");
  }

  if (!scope) {
    throw new Error("Scope is missing");
  }

  const authUrl = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
  const params = new URLSearchParams();

  params.append("scope", scope);

  try {
    const res = await axios.post<AuthResponseType>(authUrl, params, {
      headers: {
        Authorization: `Bearer ${authData}`,
        RqUID: guid,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });

    if (res.data && res.data.access_token) {
      cachedToken = res.data.access_token;
      tokenExpiry = Date.now() + res.data.expires_at * 1000;
      return cachedToken;
    } else {
      throw new Error("Invalid response from OAuth service");
    }
  } catch (err) {
    console.error("Error getting access token:", err);
    return Promise.reject("Failed to obtain access token");
  }
};
