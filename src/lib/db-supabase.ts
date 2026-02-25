import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upzkzabfysbvfwyzmqgb.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwemt6YWJmeXNidmZ3eXptcWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjcxNTcsImV4cCI6MjA4NTI0MzE1N30._HCTpA1PTZHSON9DD4t6NlDmEq9qBL0gHcAtB7PmXAI';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

export interface Mission { id: string; name: string; description: string; status: string; created_at: string; updated_at: string; }
export interface Task { id: string; title: string; description: string; status: string; priority: string; mission_id: string | null; assigned_agent_id: string | null; openclaw_session_key: string | null; sort_order: number; created_at: string; updated_at: string; }
export interface TaskComment { id: string; task_id: string; agent_id: string | null; author_type: string; content: string; created_at: string; }
export interface ActivityEntry { id: string; type: string; agent_id: string | null; task_id: string | null; mission_id: string | null; message: string; metadata: Record<string, unknown>; created_at: string; }

export function listMissions(): Mission[] { const r: any = getSupabase().from('missions').select('*').order('created_at', { ascending: false }); return r.data || []; }
export function getMission(id: string): Mission | undefined { const r: any = getSupabase().from('missions').select('*').eq('id', id).single(); return r.data; }
export function createMission(d: { id: string; name: string; description?: string }): Mission { const m = { id: d.id, name: d.name, description: d.description || '', status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; (getSupabase().from('missions').insert(m).select().single() as any).data; return m; }
export function updateMission(id: string, p: Partial<{ name: string; description: string; status: string }>): Mission | undefined { const r: any = getSupabase().from('missions').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id).select().single(); return r.data; }
export function deleteMission(id: string): void { getSupabase().from('missions').delete().eq('id', id); }

export function listTasks(f?: { status?: string; mission_id?: string; assigned_agent_id?: string }): Task[] { let q: any = getSupabase().from('tasks').select('*'); if (f?.status) q = q.eq('status', f.status); if (f?.mission_id) q = q.eq('mission_id', f.mission_id); if (f?.assigned_agent_id) q = q.eq('assigned_agent_id', f.assigned_agent_id); const r = q.order('sort_order', { ascending: true }).order('created_at', { ascending: false }); return (r as any).data || []; }
export function getTask(id: string): Task | undefined { const r: any = getSupabase().from('tasks').select('*').eq('id', id).single(); return r.data; }
export function createTask(d: { id: string; title: string; description?: string; status?: string; priority?: string; mission_id?: string; assigned_agent_id?: string }): Task { const mr: any = getSupabase().from('tasks').select('sort_order').eq('status', d.status || 'inbox').order('sort_order', { ascending: false }).limit(1).single(); const t = { id: d.id, title: d.title, description: d.description || '', status: d.status || 'inbox', priority: d.priority || 'medium', mission_id: d.mission_id || null, assigned_agent_id: d.assigned_agent_id || null, openclaw_session_key: null, sort_order: (mr.data?.sort_order || 0) + 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; (getSupabase().from('tasks').insert(t).select().single() as any).data; return t; }
export function updateTask(id: string, p: Partial<Task>): Task | undefined { const r: any = getSupabase().from('tasks').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id).select().single(); return r.data; }
export function deleteTask(id: string): void { getSupabase().from('tasks').delete().eq('id', id); }

export function listComments(taskId: string): TaskComment[] { const r: any = getSupabase().from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true }); return r.data || []; }
export function addComment(d: { id: string; task_id: string; agent_id?: string; author_type?: string; content: string }): TaskComment { const c = { id: d.id, task_id: d.task_id, agent_id: d.agent_id || null, author_type: d.author_type || 'agent', content: d.content, created_at: new Date().toISOString() }; (getSupabase().from('task_comments').insert(c).select().single() as any).data; return c; }

export function logActivity(d: { id: string; type: string; agent_id?: string; task_id?: string; mission_id?: string; message: string; metadata?: Record<string, unknown> }): void { getSupabase().from('activity_log').insert({ id: d.id, type: d.type, agent_id: d.agent_id || null, task_id: d.task_id || null, mission_id: d.mission_id || null, message: d.message, metadata: d.metadata || {}, created_at: new Date().toISOString() }); }
export function listActivity(o?: { limit?: number; type?: string }): ActivityEntry[] { let q: any = getSupabase().from('activity_log').select('*'); if (o?.type) q = q.eq('type', o.type); const r = q.order('created_at', { ascending: false }).limit(o?.limit || 50); return r.data || []; }
