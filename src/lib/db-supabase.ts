// Supabase-based mission control database
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://upzkzabfysbvfwyzmqgb.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwemt6YWJmeXNidmZ3eXptcWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjcxNTcsImV4cCI6MjA4NTI0MzE1N30._HCTpA1PTZHSON9DD4t6NlDmEq9qBL0gHcAtB7PmXAI';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// --- Types ---

export interface Mission {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  mission_id: string | null;
  assigned_agent_id: string | null;
  openclaw_session_key: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  agent_id: string | null;
  author_type: 'agent' | 'user' | 'system';
  content: string;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  agent_id: string | null;
  task_id: string | null;
  mission_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Missions ---

export function listMissions(): Mission[] {
  const sb = getSupabase();
  const { data, error } = sb.from('missions').select('*').order('created_at', { ascending: false });
  if (error) { console.error('listMissions error:', error); return []; }
  return (data as Mission[]) || [];
}

export function getMission(id: string): Mission | undefined {
  const sb = getSupabase();
  const { data } = sb.from('missions').select('*').eq('id', id).single();
  return (data as Mission) || undefined;
}

export function createMission(data: { id: string; name: string; description?: string }): Mission {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const mission = { id: data.id, name: data.name, description: data.description || '', status: 'active', created_at: now, updated_at: now };
  sb.from('missions').insert(mission).select().single();
  return mission;
}

export function updateMission(id: string, patch: Partial<{ name: string; description: string; status: string }>): Mission | undefined {
  const sb = getSupabase();
  const { data } = sb.from('missions').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return (data as Mission) || undefined;
}

export function deleteMission(id: string): void {
  getSupabase().from('missions').delete().eq('id', id);
}

// --- Tasks ---

export function listTasks(filters?: { status?: string; mission_id?: string; assigned_agent_id?: string }): Task[] {
  const sb = getSupabase();
  let query = sb.from('tasks').select('*');
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.mission_id) query = query.eq('mission_id', filters.mission_id);
  if (filters?.assigned_agent_id) query = query.eq('assigned_agent_id', filters.assigned_agent_id);
  const { data, error } = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) { console.error('listTasks error:', error); return []; }
  return (data as Task[]) || [];
}

export function getTask(id: string): Task | undefined {
  const sb = getSupabase();
  const { data } = sb.from('tasks').select('*').eq('id', id).single();
  return (data as Task) || undefined;
}

export function createTask(data: { id: string; title: string; description?: string; status?: string; priority?: string; mission_id?: string; assigned_agent_id?: string }): Task {
  const sb = getSupabase();
  const now = new Date().toISOString();
  const { data: maxData } = sb.from('tasks').select('sort_order').eq('status', data.status || 'inbox').order('sort_order', { ascending: false }).limit(1).single();
  const nextOrder = (maxData?.sort_order || 0) + 1;
  const task = { id: data.id, title: data.title, description: data.description || '', status: (data.status || 'inbox'), priority: (data.priority || 'medium'), mission_id: data.mission_id || null, assigned_agent_id: data.assigned_agent_id || null, openclaw_session_key: null, sort_order: nextOrder, created_at: now, updated_at: now };
  sb.from('tasks').insert(task).select().single();
  return task;
}

export function updateTask(id: string, patch: Partial<Task>): Task | undefined {
  const sb = getSupabase();
  const { data } = sb.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  return (data as Task) || undefined;
}

export function deleteTask(id: string): void {
  getSupabase().from('tasks').delete().eq('id', id);
}

// --- Comments ---

export function listComments(taskId: string): TaskComment[] {
  const sb = getSupabase();
  const { data } = sb.from('task_comments').select('*').eq('task_id', taskId).order('created_at', { ascending: true });
  return (data as TaskComment[]) || [];
}

export function addComment(data: { id: string; task_id: string; agent_id?: string; author_type?: string; content: string }): TaskComment {
  const sb = getSupabase();
  const comment = { id: data.id, task_id: data.task_id, agent_id: data.agent_id || null, author_type: (data.author_type || 'agent'), content: data.content, created_at: new Date().toISOString() };
  sb.from('task_comments').insert(comment).select().single();
  return comment as TaskComment;
}

// --- Activity Log ---

export function logActivity(data: { id: string; type: string; agent_id?: string; task_id?: string; mission_id?: string; message: string; metadata?: Record<string, unknown> }): void {
  const entry = { id: data.id, type: data.type, agent_id: data.agent_id || null, task_id: data.task_id || null, mission_id: data.mission_id || null, message: data.message, metadata: data.metadata || {}, created_at: new Date().toISOString() };
  getSupabase().from('activity_log').insert(entry);
}

export function listActivity(opts?: { limit?: number; type?: string }): ActivityEntry[] {
  const sb = getSupabase();
  let query = sb.from('activity_log').select('*');
  if (opts?.type) query = query.eq('type', opts.type);
  const { data } = query.order('created_at', { ascending: false }).limit(opts?.limit || 50);
  return (data as ActivityEntry[]) || [];
}
