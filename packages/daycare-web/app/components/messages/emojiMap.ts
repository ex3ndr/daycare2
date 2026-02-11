// Map of shortcodes to Unicode emoji characters
export const emojiMap: Record<string, string> = {
  ":thumbsup:": "\u{1F44D}",
  ":fire:": "\u{1F525}",
  ":heart:": "\u{2764}\u{FE0F}",
  ":laugh:": "\u{1F602}",
  ":eyes:": "\u{1F440}",
  ":check:": "\u{2705}",
  ":clap:": "\u{1F44F}",
  ":rocket:": "\u{1F680}",
  ":thinking:": "\u{1F914}",
  ":100:": "\u{1F4AF}",
};

// Ordered list of picker emoji for display
export const pickerEmoji = Object.entries(emojiMap).map(([shortcode, emoji]) => ({
  shortcode,
  emoji,
}));

// Convert a shortcode to its Unicode emoji, or return the shortcode as-is
export function shortcodeToEmoji(shortcode: string): string {
  return emojiMap[shortcode] ?? shortcode;
}
