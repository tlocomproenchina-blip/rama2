import React from 'react';
import ReactMarkdown from 'react-markdown';

const components = {
  h1: (props) => <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground sm:text-3xl" {...props} />,
  h2: (props) => <h2 className="mt-10 font-display text-2xl font-extrabold text-foreground" {...props} />,
  h3: (props) => <h3 className="mt-8 font-display text-xl font-bold text-foreground" {...props} />,
  p: (props) => <p className="mt-4 leading-relaxed text-muted-foreground" {...props} />,
  ul: (props) => <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground marker:text-primary" {...props} />,
  ol: (props) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted-foreground marker:text-primary" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  a: (props) => <a className="font-medium text-link underline-offset-4 hover:underline" {...props} />,
  blockquote: (props) => <blockquote className="mt-4 border-l-4 border-primary bg-accent px-4 py-2 text-foreground" {...props} />,
};

export default function BlogMarkdown({ content }) {
  return <ReactMarkdown components={components}>{content || ''}</ReactMarkdown>;
}