import { Fragment, type ReactNode } from "react";

/**
 * Wraps phrases inside a plain string.
 *
 * `lib/content.ts` keeps every string on the site as a string, so copy can be
 * edited without touching JSX. When a sentence needs a link or a bold word,
 * the section names the phrase and these find it and wrap it.
 */
export function DecoratedText({
  text,
  phrases,
  decorate,
}: {
  text: string;
  phrases: readonly string[];
  decorate: (phrase: string) => ReactNode;
}) {
  if (phrases.length === 0) return text;

  const escapedPhrases = phrases.map((phrase) =>
    phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const phrasePattern = new RegExp(`(${escapedPhrases.join("|")})`, "g");

  return text.split(phrasePattern).map((segment, index) =>
    phrases.includes(segment) ? (
      <Fragment key={`${segment}-${index}`}>{decorate(segment)}</Fragment>
    ) : (
      segment
    ),
  );
}

/** The common case: the named phrases in white, the rest as styled by the parent. */
export function HighlightedText({
  text,
  phrases,
}: {
  text: string;
  phrases: readonly string[];
}) {
  return (
    <DecoratedText
      text={text}
      phrases={phrases}
      decorate={(phrase) => (
        <span className="font-medium text-white">{phrase}</span>
      )}
    />
  );
}
