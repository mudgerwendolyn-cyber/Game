/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import { Hero, Monster, Skill, SkillType, BossAbility } from "../types";

// 我们可以通过环境变量配置兼容的国内 API（比如 DeepSeek, 通义千问, 智谱等）
// 默认回退到一个空对象，避免在未配置时直接崩溃
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "your-deepseek-api-key", 
  baseURL: import.meta.env.VITE_OPENAI_BASE_URL || "https://api.deepseek.com/v1", // 默认使用 deepseek
  dangerouslyAllowBrowser: true // 允许在前端直接调用（仅供演示/个人项目使用）
});

// 如果没有配置API Key，我们将自动使用本地降级方案
const hasApiKey = !!import.meta.env.VITE_OPENAI_API_KEY;

export async function generateHeroDetails(level: number): Promise<{ name: string; skills: Skill[] }> {
  if (!hasApiKey) {
    return {
      name: `勇者 Lv.${level}`,
      skills: [{ name: "重击", type: SkillType.SINGLE_DAMAGE, description: "一次简单的打击", value: 10 }]
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat", // 使用 DeepSeek 或其他兼容模型
      messages: [
        { role: "system", content: "你是一个游戏设计助手。请务必严格返回JSON格式，不要包含任何Markdown标记（例如 ```json）或多余的文字。" },
        { role: "user", content: `为合成游戏生成一个富有创意的玄幻英雄名字和1-2个强力技能，英雄等级为 ${level}。风格应史诗但简洁。
        返回一个JSON对象，包含：
        "name": 字符串, 
        "skills": 数组，包含 { "name": 字符串, "type": 字符串 (以下之一: SINGLE_DAMAGE, AOE_DAMAGE, CRIT, HEAL), "description": 字符串, "value": 数字 }` }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || "{}");
  } catch (error) {
    console.error("AI Generation failed, using fallback", error);
    return {
      name: `勇者 Lv.${level}`,
      skills: [{ name: "剑气", type: SkillType.SINGLE_DAMAGE, description: "破空的一击", value: 15 }]
    };
  }
}

export async function generateBossDetails(level: number): Promise<{ name: string; description: string; battleQuotes: string[]; ability: BossAbility }> {
  if (!hasApiKey) {
    return {
      name: `远古霸主 Lv.${level}`,
      description: "纯粹毁灭的化身。",
      battleQuotes: ["在我面前跪下！", "这就是终结。"],
      ability: BossAbility.ENRAGE
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "你是一个游戏设计助手。请务必严格返回JSON格式，不要包含任何Markdown标记。" },
        { role: "user", content: `为等级为 ${level} 的英雄生成一个强大的传奇BOSS。名字应具有威慑力。描述应简短。包含4句它在战斗中会说的攻击性台词。从以下能力中选择一个：ARMOR, HEAL, ENRAGE, VAMPIRISM。
        返回一个JSON对象，包含： "name": 字符串, "description": 字符串, "battleQuotes": 字符串数组, "ability": 字符串` }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || "{}");
  } catch (error) {
    return {
      name: `远古霸主 Lv.${level}`,
      description: "纯粹毁灭的化身。",
      battleQuotes: ["在我面前跪下！", "懦弱即是罪孽。", "我是永恒的！", "这就是终结。"],
      ability: BossAbility.ENRAGE
    };
  }
}

export async function generateMonsterDetails(level: number): Promise<{ name: string; description: string; battleQuotes: string[] }> {
  if (!hasApiKey) {
    return {
      name: `暗影兽 Lv.${level}`,
      description: "潜伏在夜晚的阴影生物。",
      battleQuotes: ["嘶嘶...", "你必将陨落！"]
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
         { role: "system", content: "你是一个游戏设计助手。请务必严格返回JSON格式，不要包含任何Markdown标记。" },
         { role: "user", content: `生成一个等级为 ${level} 的非BOSS小怪。名字应具有幻想感。描述应简短。包含3句它在战斗中会说的台词。
        返回一个JSON对象，包含： "name": 字符串, "description": 字符串, "battleQuotes": 字符串数组` }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || "{}");
  } catch (error) {
    return {
      name: `暗影兽 Lv.${level}`,
      description: "潜伏在夜晚的阴影生物。",
      battleQuotes: ["嘶嘶...", "你必将陨落！", "感受我的愤怒！"]
    };
  }
}