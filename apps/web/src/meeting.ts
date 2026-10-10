export type MeetingResult = {
  document: {id: string};
  notes: {summary: string; action_items: {description: string; owner: string|null; due_date: string|null; evidence_quote: string}[]};
};

export async function saveMeeting(token: string, workspace: string, title: string, transcript: string, fetcher: typeof fetch = fetch): Promise<MeetingResult> {
  if (!/^[a-f0-9]{32}$/.test(workspace)) throw Error('Select a valid workspace.');
  if (!title.trim() || [...title].length > 200) throw Error('Meeting title must contain 1–200 characters.');
  if (!transcript.trim() || [...transcript].length > 6000) throw Error('Meeting transcript must contain 1–6000 characters.');
  const response = await fetcher(`/v1/workspaces/${workspace}/meetings`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({meeting_id: crypto.randomUUID(), title, transcript, readers: [], data_class: 'restricted'}),
  });
  const body = await response.json();
  if (!response.ok) throw Error(body.error?.message || 'Meeting save failed.');
  return body;
}
