import React from 'react';
import { TextProps } from 'react-native';
import { Text } from '../design-system';
import { splitHighlight } from '../lib/highlight';

interface Props extends TextProps {
  text: string;
  query: string;
  variant?: 'label' | 'body' | 'caption';
}

/** Renders `text` with the parts that match `query` emphasised. */
export function HighlightText({ text, query, variant = 'label', ...props }: Props) {
  return (
    <Text variant={variant} {...props}>
      {splitHighlight(text, query).map((part, i) =>
        part.match ? (
          <Text key={i} className="font-semibold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900">
            {part.text}
          </Text>
        ) : (
          part.text
        )
      )}
    </Text>
  );
}
