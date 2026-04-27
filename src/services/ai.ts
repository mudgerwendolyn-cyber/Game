/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { Hero, Monster, Skill, SkillType, BossAbility } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateHeroDetails(level: number): Promise<{ name: string; skills: Skill[] }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `为合成游戏生成一个富有创意的玄幻英雄名字和1-2个强力技能，英雄等级为 ${level}。风格应史诗但简洁。
      请用中文回复。
      返回一个JSON对象，包含：
      "name": 字符串, 
      "skills": 数组，包含 { "name": 字符串, "type": 字符串 (以下之一: SINGLE_DAMAGE, AOE_DAMAGE, CRIT, HEAL), "description": 字符串, "value": 数字 }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            skills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: Object.values(SkillType) },
                  description: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                },
                required: ["name", "type", "description", "value"]
              }
            }
          },
          required: ["name", "skills"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Generation failed, using fallback", error);
    return {
      name: `勇者 Lv.${level}`,
      skills: [{ name: "重击", type: SkillType.SINGLE_DAMAGE, description: "一次简单的打击", value: 10 }]
    };
  }
}

export async function generateBossDetails(level: number): Promise<{ name: string; description: string; battleQuotes: string[]; ability: BossAbility }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `为等级为 ${level} 的英雄生成一个强大的传奇BOSS。名字应具有威慑力。描述应简短。
      包含4句它在战斗中会说的攻击性台词。
      从以下能力中选择一个：ARMOR, HEAL, ENRAGE, VAMPIRISM。
      请用中文回复。
      返回一个JSON对象，包含： "name": 字符串, "description": 字符串, "battleQuotes": 字符串数组, "ability": 字符串`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            battleQuotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            ability: { type: Type.STRING, enum: Object.values(BossAbility) }
          },
          required: ["name", "description", "battleQuotes", "ability"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `生成一个等级为 ${level} 的非BOSS小怪。名字应具有幻想感。描述应简短。
      包含3句它在战斗中会说的台词。
      请用中文回复。
      返回一个JSON对象，包含： "name": 字符串, "description": 字符串, "battleQuotes": 字符串数组`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            battleQuotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["name", "description", "battleQuotes"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    return {
      name: `暗影兽 Lv.${level}`,
      description: "潜伏在夜晚的阴影生物。",
      battleQuotes: ["嘶嘶...", "你必将陨落！", "感受我的愤怒！"]
    };
  }
}
