import axios from "axios";
import { HEADERS } from "./config/models";

export function createClient(timeout: number) {
  return axios.create({
    baseURL: process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1",
    timeout,
    headers: HEADERS(process.env.OPENROUTER_KEY!),
  });
}
