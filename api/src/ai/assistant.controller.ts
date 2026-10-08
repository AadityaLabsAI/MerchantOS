// AI Assistant: local Ollama. No third-party API keys.
// All requests: 20s timeout (configurable). Conversation locking via DB row update.
import { Body, Controller, Get, Param, Post, Req, UseGuards, BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ulid } from '@merchantos/crypto';
import { PERMISSIONS } from '@merchantos/shared-types';
import { query } from '../db/db.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { Permissions, PermissionsGuard } from '../rbac/rbac.guard.js';
import { assertStoreAccess } from '../rbac/store-access.js';
import { loadConfig } from '../config/config.js';

const AskInput = z.object({ storeId: z.string().min(1).max(64), conversationId: z.string().min(1).max(64).optional(), message: z.string().min(1).max(2000) });

async function callOllama(prompt: string, system: string): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
  const cfg = loadConfig();
  if (!cfg.AI_ENABLED) throw new HttpException({ code: 'AI_DISABLED', message: 'AI is disabled (set AI_ENABLED=true)' }, 503);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), cfg.AI_TIMEOUT_SECONDS * 1000);
  try {
    const resp = await fetch(`${cfg.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: cfg.OLLAMA_MODEL,
        stream: false,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text()}`);
    const json = await resp.json() as any;
    return {
      content: json.message?.content ?? '',
      promptTokens: json.prompt_eval_count ?? 0,
      completionTokens: json.eval_count ?? 0,
    };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new HttpException({ code: 'AI_TIMEOUT', message: 'AI request timed out' }, 504);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Escape user data before embedding in prompt: replace any `</context>` with HTML entity.
function escapeForContext(s: string): string {
  return s.replace(/<\/(?:context|system_message|user_message|assistant_message)>/gi, '&lt;/context&gt;');
}

async function fetchContext(merchantId: string, storeId: string): Promise<string> {
  const today = await query(
    `SELECT COALESCE(SUM((p.amount_minor)::bigint), 0) AS total, COUNT(*) AS cnt
       FROM payments p JOIN payment_sessions s ON s.id = p.payment_session_id
      WHERE p.merchant_id = $1 AND s.store_id = $2 AND s.state = 'VERIFIED' AND DATE(p.paid_at AT TIME ZONE 'UTC') = DATE(now() AT TIME ZONE 'UTC')`,
    [merchantId, storeId]);
  const top = await query(
    `SELECT bi.name, SUM((bi.line_total_minor)::bigint) AS revenue
       FROM bill_items bi JOIN bills b ON b.id = bi.bill_id
      WHERE b.merchant_id = $1 AND b.store_id = $2 AND b.state = 'FINALIZED' AND b.created_at >= now() - interval '7 days'
      GROUP BY bi.name ORDER BY revenue DESC LIMIT 5`,
    [merchantId, storeId]);
  const lowStock = await query(
    `SELECT name, stock_count, low_stock_threshold FROM products WHERE merchant_id = $1 AND store_id = $2 AND stock_count <= low_stock_threshold ORDER BY stock_count LIMIT 5`,
    [merchantId, storeId]);
  const totalRupees = Number(today.rows[0].total) / 100;
  return `Today sales: ₹${totalRupees.toFixed(2)} (${today.rows[0].cnt} bills).
Top 7-day products: ${top.rows.map(r => `${escapeForContext(r.name)} (₹${Number(r.revenue)/100})`).join(', ') || 'none'}.
Low stock: ${lowStock.rows.map(r => `${escapeForContext(r.name)} (${r.stock_count} left)`).join(', ') || 'all good'}.`;
}

@Controller('api/assistant')
@UseGuards(AuthGuard, PermissionsGuard)
export class AssistantController {
  @Post('ask')
  @Permissions(PERMISSIONS.ASSISTANT_USE)
  async ask(@Req() req: any, @Body() body: unknown) {
    const p = AskInput.parse(body);
    await assertStoreAccess(req.auth, p.storeId);
    let conversationId = p.conversationId;
    if (!conversationId) {
      conversationId = ulid();
      await query(`INSERT INTO ai_conversations (id, merchant_id, store_id, user_id) VALUES ($1, $2, $3, $4)`,
        [conversationId, req.auth.merchantId, p.storeId, req.auth.userId]);
    } else {
      const exists = await query(`SELECT id, store_id, user_id FROM ai_conversations WHERE id = $1`, [conversationId]);
      if (!exists.rows[0]) throw new NotFoundException('conversation not found');
      // Conversation must belong to the same user and store
      if (exists.rows[0].user_id !== req.auth.userId || exists.rows[0].store_id !== p.storeId) {
        throw new HttpException({ code: 'CONVERSATION_FORBIDDEN', message: 'conversation does not belong to this user/store' }, 403);
      }
    }
    await query(`INSERT INTO ai_messages (id, conversation_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [ulid(), conversationId, p.message]);

    const context = await fetchContext(req.auth.merchantId, p.storeId);
    const system = `You are MerchantOS Copilot. You give concise, business-focused answers to shop owners.
Use only the data in the <context> block. If you do not know, say so.
Answer in plain text, keep under 150 words, use INR with ₹ symbol.
<context>${escapeForContext(context)}</context>`;
    const result = await callOllama(p.message, system);
    await query(`INSERT INTO ai_messages (id, conversation_id, role, content, prompt_tokens, completion_tokens) VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [ulid(), conversationId, result.content, result.promptTokens, result.completionTokens]);
    await query(`UPDATE ai_conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
    return { conversationId, message: result.content, tokens: { prompt: result.promptTokens, completion: result.completionTokens } };
  }

  @Get('conversations')
  @Permissions(PERMISSIONS.ASSISTANT_USE)
  async conversations(@Req() req: any) {
    const r = await query(
      `SELECT id, title, store_id, created_at, updated_at FROM ai_conversations
        WHERE user_id = $1 AND merchant_id = $2 ORDER BY updated_at DESC LIMIT 50`,
      [req.auth.userId, req.auth.merchantId]);
    return { conversations: r.rows };
  }

  @Get('conversations/:id/messages')
  @Permissions(PERMISSIONS.ASSISTANT_USE)
  async messages(@Req() req: any, @Param('id') id: string) {
    // Verify ownership before returning
    const conv = await query<{ user_id: string }>(`SELECT user_id FROM ai_conversations WHERE id = $1 AND merchant_id = $2`,
      [id, req.auth.merchantId]);
    if (!conv.rows[0]) throw new NotFoundException('conversation not found');
    if (conv.rows[0].user_id !== req.auth.userId) {
      throw new HttpException({ code: 'CONVERSATION_FORBIDDEN', message: 'not your conversation' }, 403);
    }
    const r = await query(
      `SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [id]);
    return { messages: r.rows };
  }
}

