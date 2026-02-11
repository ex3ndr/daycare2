/**
 * Parse search highlight text with [[ ]] markers into segments.
 * The server uses ts_headline which marks matching terms with [[ and ]].
 */
export type HighlightSegment = {
  text: string;
  highlighted: boolean;
};

export function searchHighlightParse(highlight: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let remaining = highlight;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("[[");
    if (openIdx === -1) {
      segments.push({ text: remaining, highlighted: false });
      break;
    }

    if (openIdx > 0) {
      segments.push({ text: remaining.slice(0, openIdx), highlighted: false });
    }

    const closeIdx = remaining.indexOf("]]", openIdx + 2);
    if (closeIdx === -1) {
      // Malformed: no closing marker, treat rest as plain text
      segments.push({ text: remaining.slice(openIdx), highlighted: false });
      break;
    }

    segments.push({
      text: remaining.slice(openIdx + 2, closeIdx),
      highlighted: true,
    });
    remaining = remaining.slice(closeIdx + 2);
  }

  return segments;
}
