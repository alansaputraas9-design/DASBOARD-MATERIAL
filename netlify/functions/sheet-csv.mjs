const SAFE_SHEET_ID_RE = /^[a-zA-Z0-9_-]{20,80}$/;
const SAFE_GID_RE = /^[0-9]{1,20}$/;

const NO_CACHE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: NO_CACHE_HEADERS,
      body: '',
    };
  }

  const params = event.queryStringParameters || {};
  const id = (params.id || '').trim();
  const gid = (params.gid || '0').trim();

  if (!SAFE_SHEET_ID_RE.test(id)) {
    return {
      statusCode: 400,
      headers: {
        ...NO_CACHE_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ error: 'Invalid Google Spreadsheet ID.' }),
    };
  }

  if (!SAFE_GID_RE.test(gid)) {
    return {
      statusCode: 400,
      headers: {
        ...NO_CACHE_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ error: 'Invalid sheet gid parameter.' }),
    };
  }

  const targetUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    id
  )}/export?format=csv&gid=${encodeURIComponent(gid)}&_ts=${Date.now()}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent': 'Mozilla/5.0 (compatible; KalebajengDashboard/1.0)',
      },
    });

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers: {
          ...NO_CACHE_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          error: `Google Sheets upstream error (${upstream.status}).`,
        }),
      };
    }

    const csvText = await upstream.text();
    const trimmed = csvText.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      return {
        statusCode: 403,
        headers: {
          ...NO_CACHE_HEADERS,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          error:
            'Spreadsheet belum dibagikan publik ("Siapa saja yang memiliki link dapat melihat").',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
      },
      body: csvText,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: {
        ...NO_CACHE_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        error: err instanceof Error ? err.message : 'Upstream fetch failed.',
      }),
    };
  }
}
