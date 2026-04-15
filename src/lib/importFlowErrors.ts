export type ImportFlowMethod = 'link' | 'image' | 'pdf' | 'text';

const METHOD_LABEL: Record<ImportFlowMethod, string> = {
  link: 'Link import',
  image: 'Image import',
  pdf: 'PDF import',
  text: 'Text import',
};

/** Map thrown errors / messages to a short title + actionable description for toasts. */
export function getImportFlowErrorParts(
  err: unknown,
  method: ImportFlowMethod
): { title: string; description: string } {
  const phase = METHOD_LABEL[method];
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Something went wrong';

  const lower = raw.toLowerCase();

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return {
      title: `${phase}: could not reach server`,
      description:
        'Check your internet connection. If you are on Wi‑Fi, try again or confirm the API URL (VITE_API_URL) is reachable from this device.',
    };
  }

  if (raw.includes('401') || lower.includes('unauthorized')) {
    return {
      title: `${phase}: sign-in required`,
      description: 'Your session may have expired. Sign out and sign in again, then retry the import.',
    };
  }

  if (raw.includes('413') || lower.includes('too large') || lower.includes('payload')) {
    return {
      title: `${phase}: file or payload too large`,
      description:
        method === 'pdf'
          ? 'PDF must be under 10 MB. Try compressing the file or splitting it.'
          : method === 'image'
            ? 'One or more images may be too large. Use smaller files (under 10 MB each) or fewer images.'
            : 'The request body was rejected by the server. Reduce size and try again.',
    };
  }

  if (raw.includes('422') || lower.includes('validation') || lower.includes('invalid')) {
    return {
      title: `${phase}: server rejected the input`,
      description: raw.length > 160 ? `${raw.slice(0, 157)}…` : raw,
    };
  }

  if (raw.includes('500') || lower.includes('internal server')) {
    return {
      title: `${phase}: server error`,
      description:
        'The import service hit an error while processing your request. Try again in a moment. If it keeps failing, check server logs for this request.',
    };
  }

  if (lower.includes('invalid response') || lower.includes('missing recipe')) {
    return {
      title: `${phase}: unexpected response`,
      description:
        'The server replied without recipe data. The extractor may have failed silently—try a different URL, clearer photos, or simpler text.',
    };
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return {
      title: `${phase}: timed out`,
      description: 'The server took too long to respond. Try again with a smaller PDF, fewer images, or a shorter page URL.',
    };
  }

  return {
    title: `${phase} failed`,
    description: raw.length > 220 ? `${raw.slice(0, 217)}…` : raw,
  };
}
