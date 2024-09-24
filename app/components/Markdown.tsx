import React, { forwardRef, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const Markdown = forwardRef<
  HTMLDivElement,
  {
    markdown: string;
  } & React.ComponentPropsWithoutRef<'div'>
>(({ markdown, ...props }, ref) => {
  const sanitizedHTML = useMemo(() => {
    const untrustedHTML = marked.parse(markdown, {
      async: false,
      gfm: true,
      breaks: true,
    });

    const sanitizedDOM = DOMPurify.sanitize(untrustedHTML, {
      USE_PROFILES: { html: true },
      RETURN_DOM_FRAGMENT: true,
    });

    sanitizedDOM.querySelectorAll('a').forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });

    const outer = document.createElement('div');
    outer.append(sanitizedDOM);
    return outer.innerHTML;
  }, [markdown]);

  return (
    <div
      {...props}
      ref={ref}
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  );
});

Markdown.displayName = 'Markdown';
