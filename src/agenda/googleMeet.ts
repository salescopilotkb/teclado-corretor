/**
 * Integração com Google Meet e Google Calendar para agendamento de reuniões.
 *
 * Suporta três modalidades:
 *  1. Google Calendar API v3 (oficial): cria o evento com conferência Google Meet
 *     automática e retorna o link meet.google.com/xxx-yyyy-zzz.
 *  2. Google Meet REST API v2: cria um espaço de reunião dedicado.
 *  3. Criação instantânea / template de calendário para navegador ou aplicativo.
 */

export interface GoogleMeetCreateParams {
  title: string;
  date: string; // AAAA-MM-DD
  time?: string; // HH:MM
  durationMinutes?: number;
  description?: string;
  clientEmail?: string;
}

export interface GoogleMeetResult {
  meetUrl: string;
  eventId?: string;
  calendarHtmlLink?: string;
}

/**
 * Normaliza um link digitado ou colado para a URL completa do Google Meet.
 * Ex.: "abc-defg-hij" ou "meet.google.com/abc-defg-hij" → "https://meet.google.com/abc-defg-hij".
 */
export function normalizeMeetUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const clean = raw.trim();
  if (!clean) return null;

  if (/^https?:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(clean)) {
    return clean;
  }
  if (/^meet\.google\.com\/[a-z0-9-]+/i.test(clean)) {
    return `https://${clean}`;
  }
  // Se for apenas o código de 10 letras (ex.: "abc-defg-hij" ou "abcdefghij")
  const codeMatch = clean.match(/^([a-z]{3})-?([a-z]{4})-?([a-z]{3})$/i);
  if (codeMatch) {
    return `https://meet.google.com/${codeMatch[1].toLowerCase()}-${codeMatch[2].toLowerCase()}-${codeMatch[3].toLowerCase()}`;
  }
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  return `https://${clean}`;
}

/** URL para criar uma sala instantânea no Google Meet do usuário. */
export const GOOGLE_MEET_NEW_URL = 'https://meet.google.com/new';

/**
 * Cria uma reunião oficial com link do Google Meet usando a API do Google Calendar v3.
 * Requer um accessToken OAuth 2.0 (escopo https://www.googleapis.com/auth/calendar.events).
 */
export async function createGoogleCalendarMeet(
  params: GoogleMeetCreateParams,
  accessToken: string
): Promise<GoogleMeetResult> {
  const duration = params.durationMinutes ?? 60;
  const startTime = params.time ? `${params.time}:00` : '09:00:00';
  const startIso = `${params.date}T${startTime}`;

  const startDate = new Date(startIso);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const requestId = `keycon-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const body: Record<string, unknown> = {
    summary: params.title,
    description: params.description ?? 'Reunião agendada via KEYCON',
    start: {
      dateTime: startDate.toISOString(),
    },
    end: {
      dateTime: endDate.toISOString(),
    },
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  };

  if (params.clientEmail) {
    body.attendees = [{ email: params.clientEmail }];
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao criar reunião no Google Calendar API: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const meetUrl =
    data.conferenceData?.entryPoints?.find((ep: { entryPointType: string }) => ep.entryPointType === 'video')?.uri ||
    data.hangoutLink;

  if (!meetUrl) {
    throw new Error('A API do Google Calendar não retornou um link de videoconferência.');
  }

  return {
    meetUrl,
    eventId: data.id,
    calendarHtmlLink: data.htmlLink,
  };
}

/**
 * Cria um espaço de reunião diretamente na Google Meet REST API v2.
 * Requer um accessToken com escopo https://www.googleapis.com/auth/meetings.space.created.
 */
export async function createGoogleMeetSpace(accessToken: string): Promise<string> {
  const response = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha na Google Meet API: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.meetingUri) {
    throw new Error('A Google Meet API não retornou o meetingUri.');
  }

  return data.meetingUri;
}

/**
 * Gera a URL do Google Calendar para ser aberta no navegador do usuário,
 * pré-preenchida com data, hora e título.
 */
export function generateGoogleCalendarTemplateUrl(params: GoogleMeetCreateParams): string {
  const startTime = params.time ? params.time.replace(':', '') + '00' : '090000';
  const duration = params.durationMinutes ?? 60;
  const startDate = new Date(`${params.date}T${params.time ?? '09:00'}:00`);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
  const endHours = String(endDate.getHours()).padStart(2, '0');
  const endMins = String(endDate.getMinutes()).padStart(2, '0');
  const endTime = `${endHours}${endMins}00`;

  const dateCompact = params.date.replace(/-/g, '');
  const dates = `${dateCompact}T${startTime}/${dateCompact}T${endTime}`;

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates,
    details: params.description ?? 'Reunião agendada via KEYCON',
  });

  if (params.clientEmail) {
    query.set('add', params.clientEmail);
  }

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
